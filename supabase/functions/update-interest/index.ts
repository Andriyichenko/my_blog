import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number)
  }

  if (typeof value === 'string') {
    return value
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v))
  }

  throw new Error(`Invalid vector format: ${typeof value}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const { article_slug, user_id } = await req.json()

    console.log('update-interest request:', {
      article_slug,
      user_id,
    })

    if (!article_slug || !user_id) {
      throw new Error('Missing article_slug or user_id')
    }

    // 1. 获取文章 embedding
    const { data: postData, error: postError } = await supabaseClient
      .from('post_embeddings')
      .select('embedding')
      .eq('slug', article_slug)
      .maybeSingle()

    if (postError) {
      console.error('post_embeddings query error:', postError)
      throw postError
    }

    if (!postData || !postData.embedding) {
      console.log('No embedding found for slug:', article_slug)

      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'No embedding found',
          article_slug,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      )
    }

    const articleVector = parseVector(postData.embedding)

    if (articleVector.length !== 1536) {
      throw new Error(`Article embedding dimension mismatch: ${articleVector.length}`)
    }

    // 2. 获取用户画像
    const { data: userData, error: userError } = await supabaseClient
      .from('user_profiles')
      .select('interest_embedding')
      .eq('user_id', user_id)
      .maybeSingle()

    if (userError) {
      console.error('user_profiles query error:', userError)
      throw userError
    }

    let newVector = articleVector

    if (userData?.interest_embedding) {
      const oldVector = parseVector(userData.interest_embedding)

      if (oldVector.length === articleVector.length) {
        const alpha = 0.15

        newVector = oldVector.map((val, i) => {
          return val * (1 - alpha) + articleVector[i] * alpha
        })
      } else {
        console.warn('User embedding dimension mismatch, reset profile:', {
          oldLength: oldVector.length,
          newLength: articleVector.length,
        })
      }
    }

    // 3. 写入 user_profiles
    const { error: updateError } = await supabaseClient
      .from('user_profiles')
      .upsert(
        {
          user_id,
          interest_embedding: newVector,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (updateError) {
      console.error('user_profiles upsert error:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        article_slug,
        user_id,
        dimension: newVector.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error) {
    console.error('update-interest failed:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    )
  }
})