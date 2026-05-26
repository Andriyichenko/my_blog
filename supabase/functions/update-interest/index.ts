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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { article_slug, user_id } = await req.json()

    if (!article_slug || !user_id) {
        throw new Error("Missing article_slug or user_id");
    }

    // 1. Get article embedding
    const { data: postData, error: postError } = await supabaseClient
      .from('post_embeddings')
      .select('embedding')
      .eq('slug', article_slug)
      .single()

    if (postError || !postData) {
        console.error("Post error:", postError);
        throw new Error("Article not found or no embedding");
    }

    const articleVector = postData.embedding;

    // 2. Get user profile
    const { data: userData, error: userError } = await supabaseClient
      .from('user_profiles')
      .select('interest_embedding')
      .eq('user_id', user_id)
      .single()

    let newVector = articleVector; // Default if no history
    
    if (userData && userData.interest_embedding) {
        const oldVector = userData.interest_embedding;
        const alpha = 0.15;
        
        // Weighted Moving Average
        if (oldVector.length === articleVector.length) {
            newVector = oldVector.map((val: number, i: number) => {
                return val * (1 - alpha) + articleVector[i] * alpha;
            });
        }
    }

    // 3. Update user profile
    const { error: updateError } = await supabaseClient
        .from('user_profiles')
        .upsert({ 
            user_id: user_id, 
            interest_embedding: newVector,
            updated_at: new Date().toISOString()
        })

    if (updateError) {
        throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
