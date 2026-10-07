-- 在新版点赞/分享前端部署上线之后再执行（旧页面仍在调用这些函数、直接读写这些表）

-- 旧函数接受任意 p_user_ip，可被用来刷赞；SECURITY DEFINER 且未设置 search_path
revoke execute on function public.increment_like(text, text)          from public, anon, authenticated;
revoke execute on function public.increment_like(text, integer, text) from public, anon, authenticated;
revoke execute on function public.increment_like(text, integer)       from public, anon, authenticated;
revoke execute on function public.decrement_like(text)                from public, anon, authenticated;
revoke execute on function public.increment_share(text)               from public, anon, authenticated;
revoke execute on function public.check_user_liked(text, text)        from public, anon, authenticated;

-- 收紧旧表 -------------------------------------------------------------
-- post_likes 里是旧的 IP 记录：开启 RLS 且不加 policy => 对外不可读写
alter table public.post_likes enable row level security;

-- post_stats 只允许读，写入只能经由 set_post_like / record_post_share
drop policy if exists "allow upsert"      on public.post_stats;
drop policy if exists "allow update"      on public.post_stats;
drop policy if exists "allow anon insert" on public.post_stats;
drop policy if exists "allow anon update" on public.post_stats;
revoke insert, update, delete on public.post_stats from anon, authenticated;
