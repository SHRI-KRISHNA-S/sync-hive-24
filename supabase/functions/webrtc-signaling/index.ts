import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory store for voice channel participants (in production, use Redis/database)
const voiceChannels = new Map<string, Map<string, { odId: string; sdp?: string; candidates: RTCIceCandidateInit[] }>>()

// Rate limiting: 100 requests per minute per user
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100
const RATE_WINDOW_MS = 60_000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Input validation helpers
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_ACTIONS = new Set(['join', 'leave', 'offer', 'answer', 'ice-candidate', 'get-participants'])
const MAX_SDP_LENGTH = 100_000

function validateInput(body: unknown): { valid: true; data: { action: string; channelId?: string; sdp?: string; candidate?: unknown; targetUserId?: string } } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request body' }
  const b = body as Record<string, unknown>

  if (typeof b.action !== 'string' || !VALID_ACTIONS.has(b.action)) {
    return { valid: false, error: 'Invalid action' }
  }

  if (b.channelId !== undefined && (typeof b.channelId !== 'string' || !UUID_RE.test(b.channelId))) {
    return { valid: false, error: 'Invalid channelId' }
  }

  if (b.targetUserId !== undefined && (typeof b.targetUserId !== 'string' || !UUID_RE.test(b.targetUserId))) {
    return { valid: false, error: 'Invalid targetUserId' }
  }

  if (b.sdp !== undefined && (typeof b.sdp !== 'string' || b.sdp.length > MAX_SDP_LENGTH)) {
    return { valid: false, error: 'Invalid or oversized SDP' }
  }

  return {
    valid: true,
    data: {
      action: b.action as string,
      channelId: b.channelId as string | undefined,
      sdp: b.sdp as string | undefined,
      candidate: b.candidate,
      targetUserId: b.targetUserId as string | undefined,
    },
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse and validate input
    const rawBody = await req.json()
    const validation = validateInput(rawBody)
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { action, channelId, sdp, candidate, targetUserId } = validation.data

    // Verify the user is a member of the team that owns this channel
    const actionsRequiringAuth = ['join', 'leave', 'offer', 'answer', 'ice-candidate']
    if (actionsRequiringAuth.includes(action) && channelId) {
      const { data: channel } = await supabaseClient
        .from('channels')
        .select('team_id')
        .eq('id', channelId)
        .single()

      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: membership } = await supabaseClient
        .from('team_members')
        .select('role')
        .eq('team_id', channel.team_id)
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        return new Response(JSON.stringify({ error: 'Not authorized for this channel' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    switch (action) {
      case 'join': {
        if (!channelId) {
          return new Response(JSON.stringify({ error: 'channelId required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        if (!voiceChannels.has(channelId)) {
          voiceChannels.set(channelId, new Map())
        }
        const channel = voiceChannels.get(channelId)!
        channel.set(user.id, { odId: user.id, candidates: [] })
        const participants = Array.from(channel.keys()).filter(id => id !== user.id)
        
        return new Response(JSON.stringify({ 
          success: true, 
          participants,
          userId: user.id 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'leave': {
        if (!channelId) {
          return new Response(JSON.stringify({ error: 'channelId required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const channel = voiceChannels.get(channelId)
        if (channel) {
          channel.delete(user.id)
          if (channel.size === 0) {
            voiceChannels.delete(channelId)
          }
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'offer': {
        const channel = voiceChannels.get(channelId!)
        if (channel && targetUserId) {
          const targetUser = channel.get(targetUserId)
          if (targetUser) {
            targetUser.sdp = sdp
          }
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'answer': {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'ice-candidate': {
        const channel = voiceChannels.get(channelId!)
        if (channel && targetUserId) {
          const targetUser = channel.get(targetUserId)
          if (targetUser && candidate) {
            targetUser.candidates.push(candidate as RTCIceCandidateInit)
          }
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get-participants': {
        const channel = voiceChannels.get(channelId!)
        const participants = channel ? Array.from(channel.keys()) : []
        
        return new Response(JSON.stringify({ participants }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
