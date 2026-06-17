-- =====================================================================
-- 迁移：建卡分步流程。characters 增加 creation_stage。
-- 0=未开始 1=资料完成 2=属性完成 3=技能完成 4=已确认
-- 在 Supabase → SQL Editor 整段执行（可重复执行）。
-- =====================================================================
alter table characters add column if not exists creation_stage int not null default 0;
