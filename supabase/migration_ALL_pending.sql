-- =====================================================================
-- 一次性迁移：把还没跑的三段合在一起（图片 / 头像 / 音乐状态机）。
-- 只需整段粘进 Supabase 的 SQL Editor，点一次 Run。可重复执行，安全。
-- =====================================================================

-- ---- 图片：创建公开存储桶 scene-images（存场景图和头像）----
insert into storage.buckets (id, name, public)
values ('scene-images', 'scene-images', true)
on conflict (id) do nothing;

-- ---- 角色头像字段 ----
alter table characters add column if not exists avatar_url text;
alter table characters add column if not exists appearance text;
do $$ begin
  alter publication supabase_realtime add table characters;
exception when duplicate_object then null; end $$;

-- ---- 音乐状态机字段 ----
alter table rooms add column if not exists scene_state text default 'menu';
alter table rooms add column if not exists audio_flags jsonb not null default '{}'::jsonb;

-- 完成。
