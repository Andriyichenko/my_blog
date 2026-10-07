-- 点赞 / 分享 v2
-- 旧方案的问题：
--   * 用 IP 识别访客（同一校园网的人共用 IP；还要把 IP 发给第三方 ipify），IP 明文存放在未开 RLS 的 post_likes 中
--   * post_stats 允许 anon 直接 INSERT / UPDATE，计数可以被任意篡改
--   * 取消点赞 = 前端 DELETE + 另一次 RPC，非原子，like_count 与实际记录不一致
--   * increment_like 有 3 个重载，其中一个引用不存在的 updated_at 列
-- 新方案：
--   * 浏览器生成随机 visitor_id（localStorage），数据库只保存其 sha256 摘要，不再收集 IP
--   * 所有写入都通过 SECURITY DEFINER 函数，表本身对 anon 不可写
--   * set_post_like 是幂等的“设置为某状态”，计数与记录在同一事务内更新
--   * 分享按 (文章, 访客, 天) 去重计数

-- 1. 新表 ---------------------------------------------------------------
create table if not exists public.post_like_votes (
  slug         text        not null,
  visitor_hash text        not null,
  created_at   timestamptz not null default now(),
  primary key (slug, visitor_hash)
);

create table if not exists public.post_share_events (
  slug         text        not null,
  visitor_hash text        not null,
  shared_on    date        not null default current_date,
  channel      text        not null default 'other',
  created_at   timestamptz not null default now(),
  primary key (slug, visitor_hash, shared_on)
);

alter table public.post_like_votes   enable row level security;
alter table public.post_share_events enable row level security;
revoke all on public.post_like_votes, public.post_share_events from anon, authenticated;

-- 2. 内部工具 -------------------------------------------------------------
create or replace function public._visitor_hash(p_visitor_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p_visitor_id::text, 'UTF8')), 'hex');
$$;

create or replace function public._assert_post_exists(p_slug text)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_slug is null or length(p_slug) > 200
     or not exists (select 1 from post_embeddings where slug = p_slug) then
    raise exception 'unknown post: %', p_slug using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public._visitor_hash(uuid)        from public, anon, authenticated;
revoke execute on function public._assert_post_exists(text)  from public, anon, authenticated;

-- 3. 对外 RPC -------------------------------------------------------------
-- 读取：点赞数、分享数、当前访客是否已赞
create or replace function public.get_post_engagement(p_slug text, p_visitor_id uuid default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'like_count',  coalesce((select like_count  from post_stats where slug = p_slug), 0),
    'share_count', coalesce((select share_count from post_stats where slug = p_slug), 0),
    'liked', p_visitor_id is not null and exists (
      select 1 from post_like_votes
      where slug = p_slug and visitor_hash = _visitor_hash(p_visitor_id)
    )
  );
$$;

-- 设置点赞状态（幂等）：p_liked = true 点赞，false 取消
create or replace function public.set_post_like(p_slug text, p_visitor_id uuid, p_liked boolean)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_hash    text;
  v_changed int := 0;
begin
  if p_visitor_id is null or p_liked is null then
    raise exception 'visitor id and state are required' using errcode = '22023';
  end if;
  perform _assert_post_exists(p_slug);
  v_hash := _visitor_hash(p_visitor_id);

  if p_liked then
    insert into post_like_votes (slug, visitor_hash) values (p_slug, v_hash)
    on conflict do nothing;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      insert into post_stats (slug, like_count, share_count) values (p_slug, 1, 0)
      on conflict (slug) do update set like_count = post_stats.like_count + 1;
    end if;
  else
    delete from post_like_votes where slug = p_slug and visitor_hash = v_hash;
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update post_stats set like_count = greatest(like_count - 1, 0) where slug = p_slug;
    end if;
  end if;

  return get_post_engagement(p_slug, p_visitor_id);
end;
$$;

-- 记录一次分享：同一访客对同一文章每天最多计 1 次
create or replace function public.record_post_share(p_slug text, p_visitor_id uuid, p_channel text default 'other')
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_changed int := 0;
  v_channel text := case
    when p_channel in ('copy', 'native', 'x', 'line', 'hatena', 'facebook') then p_channel
    else 'other'
  end;
begin
  if p_visitor_id is null then
    raise exception 'visitor id is required' using errcode = '22023';
  end if;
  perform _assert_post_exists(p_slug);

  insert into post_share_events (slug, visitor_hash, channel)
  values (p_slug, _visitor_hash(p_visitor_id), v_channel)
  on conflict do nothing;
  get diagnostics v_changed = row_count;

  if v_changed > 0 then
    insert into post_stats (slug, like_count, share_count) values (p_slug, 0, 1)
    on conflict (slug) do update set share_count = post_stats.share_count + 1;
  end if;

  return get_post_engagement(p_slug, p_visitor_id);
end;
$$;

revoke execute on function public.get_post_engagement(text, uuid)        from public;
revoke execute on function public.set_post_like(text, uuid, boolean)     from public;
revoke execute on function public.record_post_share(text, uuid, text)    from public;
grant  execute on function public.get_post_engagement(text, uuid)        to anon, authenticated;
grant  execute on function public.set_post_like(text, uuid, boolean)     to anon, authenticated;
grant  execute on function public.record_post_share(text, uuid, text)    to anon, authenticated;
