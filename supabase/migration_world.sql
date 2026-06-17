-- =====================================================================
-- 迁移：世界反应系统（嫌疑值）+ 多线索分类。
-- 在 Supabase → SQL Editor 执行。
-- =====================================================================
alter table rooms add column if not exists suspicion int not null default 0;
alter table rooms add column if not exists world_flags jsonb not null default '{}'::jsonb;

-- 线索归属的调查线：A建筑历史 / B失踪死亡 / C NPC异常 / D超自然 / E关键物品仪式
alter table clues add column if not exists thread text;

-- 给前端的安全视图加上 thread 字段（裁掉真相元标记）
create or replace view clues_player as
  select id, room_id, title, description, source, visible_to, discovered_turn, created_at, thread
  from clues;
