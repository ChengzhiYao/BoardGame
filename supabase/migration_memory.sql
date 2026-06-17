-- =====================================================================
-- 迁移：战役记忆系统。rooms 增加滚动记忆（摘要 + 关键事实 + 覆盖到第几回合）。
-- 在 Supabase → SQL Editor 执行。
-- =====================================================================
alter table rooms add column if not exists memory jsonb not null default '{"summary":"","key_facts":[],"up_to_round":0}'::jsonb;
