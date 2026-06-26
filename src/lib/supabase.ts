import { createClient } from '@supabase/supabase-js';

// 获取环境变量 - 在构建时避免错误
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 
                    (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined);
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 
                    (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase credentials. Featured posts will be empty.');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function getFeaturedPosts() {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('post_embeddings')
      .select('slug, title, description')
      .eq('featured', true);

    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching featured posts from Supabase:', error);
    return [];
  }
}