import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory store for voice channel participants (in production, use Redis/database)
const voiceChannels = new Map<string, Map<string, { odId: string; sdp?: string; candidates: RTCIceCandidateInit[] }>>()

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
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action, channelId, sdp, candidate, targetUserId } = await req.json()
    console.log(`[Signaling] Action: ${action}, Channel: ${channelId}, User: ${user.id}`)

    // Verify the user is a member of the team that owns this channel
    const actionsRequiringAuth = ['join', 'offer', 'answer', 'ice-candidate']
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
        // Initialize channel if not exists
        if (!voiceChannels.has(channelId)) {
          voiceChannels.set(channelId, new Map())
        }
        const channel = voiceChannels.get(channelId)!
        
        // Add user to channel
        channel.set(user.id, { odId: user.id, candidates: [] })
        
        // Get other participants
        const participants = Array.from(channel.keys()).filter(id => id !== user.id)
        console.log(`[Signaling] User ${user.id} joined. Participants: ${participants.length}`)
        
        return new Response(JSON.stringify({ 
          success: true, 
          participants,
          userId: user.id 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'leave': {
        const channel = voiceChannels.get(channelId)
        if (channel) {
          channel.delete(user.id)
          if (channel.size === 0) {
            voiceChannels.delete(channelId)
          }
        }
        console.log(`[Signaling] User ${user.id} left channel ${channelId}`)
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'offer': {
        const channel = voiceChannels.get(channelId)
        if (channel && targetUserId) {
          const targetUser = channel.get(targetUserId)
          if (targetUser) {
            targetUser.sdp = sdp
          }
        }
        console.log(`[Signaling] Offer stored for ${targetUserId}`)
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'answer': {
        console.log(`[Signaling] Answer received from ${user.id}`)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'ice-candidate': {
        const channel = voiceChannels.get(channelId)
        if (channel && targetUserId) {
          const targetUser = channel.get(targetUserId)
          if (targetUser && candidate) {
            targetUser.candidates.push(candidate)
          }
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get-participants': {
        const channel = voiceChannels.get(channelId)
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
    console.error('[Signaling] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
