-- =====================================================================
-- 迁移：图片分类型。images 增加 image_type。
-- scene_image / npc_portrait / clue_evidence / monster_image / event_illustration
-- 在 Supabase → SQL Editor 执行。
-- =====================================================================
alter table images add column if not exists image_type text not null default 'scene_image';
