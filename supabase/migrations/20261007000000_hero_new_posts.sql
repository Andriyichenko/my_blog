-- 主页 Hero 轮播：新文章自动置顶并标注 New，其余位置由 featured 文章按 featured_order 补齐
-- 在 Supabase SQL Editor 中执行，或 `supabase db push`

-- 1. 文章发布日期（由 train.py 从 frontmatter 的 pubDate / date 同步）
alter table public.post_embeddings
  add column if not exists pub_date timestamptz;

create index if not exists post_embeddings_pub_date_idx
  on public.post_embeddings (pub_date desc);

-- 2. 轮播数据：
--    - pub_date 在最近 new_days 天内的文章视为 New，按发布日期倒序排在最前
--    - 剩余位置用 featured = true 的文章按 featured_order 补齐（与 New 去重）
--    - 总数不超过 max_count
create or replace function public.get_hero_posts(
  max_count int default 4,
  new_days  int default 14
)
returns table (
  slug           text,
  title          text,
  description    text,
  pub_date       timestamptz,
  is_new         boolean,
  featured_order integer
)
language sql
stable
set search_path = public
as $$
  with new_posts as (
    select p.slug, p.title, p.description, p.pub_date, true as is_new, p.featured_order,
           row_number() over (order by p.pub_date desc, p.slug) as rk
    from post_embeddings p
    where p.pub_date is not null
      and p.pub_date >= now() - make_interval(days => new_days)
  ),
  featured_posts as (
    select p.slug, p.title, p.description, p.pub_date, false as is_new, p.featured_order,
           1000000 + row_number() over (order by p.featured_order nulls last, p.slug) as rk
    from post_embeddings p
    where p.featured
      and p.slug not in (select n.slug from new_posts n)
  )
  select u.slug, u.title, u.description, u.pub_date, u.is_new, u.featured_order
  from (select * from new_posts union all select * from featured_posts) u
  order by u.rk
  limit greatest(max_count, 0);
$$;

grant execute on function public.get_hero_posts(int, int) to anon, authenticated;
