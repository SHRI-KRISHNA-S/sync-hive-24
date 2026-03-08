import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // List all users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ALLOWED_DOMAIN = '@bitsathy.ac.in'
    const removedUsers: string[] = []

    for (const user of users) {
      if (user.email && !user.email.endsWith(ALLOWED_DOMAIN)) {
        // Delete profile first (cascade should handle but be safe)
        await supabaseAdmin.from('profiles').delete().eq('user_id', user.id)
        // Delete team memberships
        await supabaseAdmin.from('team_members').delete().eq('user_id', user.id)
        // Delete the auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
        if (!deleteError) {
          removedUsers.push(user.email)
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      removed: removedUsers,
      count: removedUsers.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
