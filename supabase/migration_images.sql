-- =====================================================================
-- 迁移：创建公开存储桶 scene-images，用于存放生成的场景插画。
-- 在 Supabase → SQL Editor 执行（可重复执行）。
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('scene-images', 'scene-images', true)
on conflict (id) do nothing;
