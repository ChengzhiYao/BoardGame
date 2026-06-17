-- =====================================================================
-- 一次性总迁移：把基础 schema.sql 之后的所有增量改动合在一起。
-- 用法：整段复制 → Supabase → SQL Editor → New query → 粘贴 → Run。
-- 安全：全部 "不存在才添加 / 可重复"，即使你之前跑过其中几段，再跑也不会报错或破坏数据。
-- 前提：你已经跑过最初那一大段 schema.sql（建好了所有表）。如果还没，请先跑 schema.sql。
-- =====================================================================

-- ---------- 1. 游戏状态机 + 模组 ----------
alter table rooms add column if not exists game_state text not null default 'lobby';
alter table rooms add column if not exists module_options jsonb;
alter table rooms add column if not exists custom_direction jsonb;
alter table rooms add column if not exists modules_generating boolean not null default false;
alter table characters add column if not exists confirmed boolean not null default false;
update rooms set game_state =
  case status
    when 'waiting' then 'lobby'
    when 'character_creation' then 'character_creation'
    when 'playing' then 'playing'
    when 'ended' then 'ended'
    else 'lobby'
  end
where game_state is null;

-- ---------- 2. 建卡分步 ----------
alter table characters add column if not exists creation_stage int not null default 0;

-- ---------- 3. 图片存储桶 + 头像 ----------
insert into storage.buckets (id, name, public)
values ('scene-images', 'scene-images', true)
on conflict (id) do nothing;
alter table characters add column if not exists avatar_url text;
alter table characters add column if not exists appearance text;
alter table characters add column if not exists gender text;
alter table characters add column if not exists current_location text;

-- ---------- 4. 音乐状态机 ----------
alter table rooms add column if not exists scene_state text default 'menu';
alter table rooms add column if not exists audio_flags jsonb not null default '{}'::jsonb;

-- ---------- 5. 世界反应（嫌疑值）+ 多线索 ----------
alter table rooms add column if not exists suspicion int not null default 0;
alter table rooms add column if not exists world_flags jsonb not null default '{}'::jsonb;
alter table clues add column if not exists thread text;

-- ---------- 6. 双人回合制 + 消息可见性 ----------
alter table rooms add column if not exists current_round int not null default 1;
alter table rooms add column if not exists pending_actions jsonb not null default '{}'::jsonb;
alter table rooms add column if not exists player_a_ready boolean not null default false;
alter table rooms add column if not exists player_b_ready boolean not null default false;
alter table rooms add column if not exists waiting_for text;
alter table rooms add column if not exists resolution_status text not null default 'collecting';
alter table messages add column if not exists visibility text not null default 'public';

drop policy if exists messages_member_read on messages;
create policy messages_member_read on messages for select using (
  is_admin() or (
    is_room_member(room_id) and (
      visibility = 'public'
      or (visibility = 'player_a' and my_seat(room_id) = 'A')
      or (visibility = 'player_b' and my_seat(room_id) = 'B')
    )
  )
);

-- ---------- 7. 战役记忆 ----------
alter table rooms add column if not exists memory jsonb not null default '{"summary":"","key_facts":[],"up_to_round":0}'::jsonb;

-- ---------- 8. 图片分类型 ----------
alter table images add column if not exists image_type text not null default 'scene_image';

-- ---------- 9. 视图：给前端的安全线索视图（含 thread，裁掉真相元标记）----------
-- security_invoker=true：视图以"查询者"身份执行，从而对底层 clues 表施加该用户的 RLS，
-- 保证私人线索（visible_to=A/B）不会泄露给另一名玩家。
create or replace view clues_player with (security_invoker = true) as
  select id, room_id, title, description, source, visible_to, discovered_turn, created_at, thread
  from clues;

-- ---------- 10. 实时：确保需要同步的表都在 publication 里 ----------
do $$ begin
  alter publication supabase_realtime add table characters;
exception when duplicate_object then null; end $$;

-- ---------- 11. 修正 messages.action_type 约束：允许 chat（对话不进结算）----------
alter table messages drop constraint if exists messages_action_type_check;
alter table messages add constraint messages_action_type_check
  check (action_type in ('investigate','talk','combat','move','free','chat'));

-- ---------- 12. 模组库：复用锁定过的案件（含真相，仅 service_role 可读）----------
create table if not exists module_library (
  id uuid primary key default gen_random_uuid(),
  title text, hook text, tagline text,
  era text, place text, difficulty text, duration text,
  case_file jsonb not null,   -- 完整案件档案（含真相），机密
  quality jsonb,              -- 质量评分
  passed boolean not null default false, -- 是否通过审稿（用于决定能否复用）
  times_used int not null default 0,
  created_at timestamptz not null default now()
);
alter table module_library add column if not exists genre text; -- 恐怖题材
alter table module_library enable row level security;
-- 不创建任何 anon/authenticated 策略：含真相，仅服务端 service_role 可读写。
create index if not exists module_library_passed_idx on module_library(passed, created_at);

-- 完成。刷新网页即可。
