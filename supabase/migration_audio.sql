-- =====================================================================
-- 迁移：音乐状态机。rooms 增加当前情绪状态 + 惊吓去重标记。
-- 在 Supabase → SQL Editor 执行。
-- =====================================================================
alter table rooms add column if not exists scene_state text default 'menu';
-- audio_flags 例：{"monsters":["雾中触手"]} 用于"同一怪物不重复惊吓"
alter table rooms add column if not exists audio_flags jsonb not null default '{}'::jsonb;
