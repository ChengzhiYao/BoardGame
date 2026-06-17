-- =====================================================================
-- 迁移：角色头像与外貌描述。在 Supabase → SQL Editor 执行。
-- =====================================================================
alter table characters add column if not exists avatar_url text;
alter table characters add column if not exists appearance text;

-- 把 characters 的更新也纳入实时（schema 里已 add 过则忽略报错）
do $$ begin
  alter publication supabase_realtime add table characters;
exception when duplicate_object then null; end $$;
