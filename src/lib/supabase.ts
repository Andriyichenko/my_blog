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
    .select('slug, title, description, featured_order')
    .eq('featured', true)
    .order('featured_order', { ascending: true });

    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching featured posts from Supabase:', error);
    return [];
  }
}

export type HeroPostRow = {
  slug: string;
  is_new: boolean;
  featured_order: number | null;
};

/**
 * 主页轮播：新文章（最近 newDays 天发布）在前并标 New，其余用 featured 文章补齐。
 * 排序逻辑在 Supabase 的 get_hero_posts RPC 中；RPC 未部署时回退到旧的 featured 查询。
 */
export async function getHeroPosts(maxCount = 4, newDays = 14): Promise<HeroPostRow[]> {
  if (!supabase) {
    console.warn('Supabase client not initialized');
    return [];
  }

  const { data, error } = await supabase.rpc('get_hero_posts', {
    max_count: maxCount,
    new_days: newDays,
  });

  if (!error) return (data as HeroPostRow[]) || [];

  console.error('Error calling get_hero_posts, falling back to featured posts:', error);
  const featured = await getFeaturedPosts();
  return featured.map((p: any) => ({ slug: p.slug, is_new: false, featured_order: p.featured_order }));
}
