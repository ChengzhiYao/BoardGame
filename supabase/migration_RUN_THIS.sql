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
alter table characters add column if not exists inventory jsonb not null default '[]'::jsonb;

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
drop view if exists clues_player;
create view clues_player with (security_invoker = true) as
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

-- ---------- 13. 海龟汤模式 ----------
alter table rooms add column if not exists mode text not null default 'coc'; -- coc | soup

-- 汤面（玩家可见）
create table if not exists soup_puzzles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  title text, surface text, difficulty text,
  status text not null default 'playing', -- playing | solved | revealed
  created_at timestamptz not null default now()
);
alter table soup_puzzles enable row level security;
drop policy if exists soup_member_read on soup_puzzles;
create policy soup_member_read on soup_puzzles for select using (is_room_member(room_id) or is_admin());

-- 汤底（机密，仅 service_role 可读）
create table if not exists soup_bottoms (
  puzzle_id uuid primary key references soup_puzzles(id) on delete cascade,
  bottom text
);
alter table soup_bottoms enable row level security;
-- 不创建任何 anon/authenticated 策略：仅服务端可读。

do $$ begin
  alter publication supabase_realtime add table soup_puzzles;
exception when duplicate_object then null; end $$;

-- ---------- 14. 真心话大冒险模式 ----------
-- rooms.mode 现可为 'coc' | 'soup' | 'td'
alter table rooms add column if not exists td_settings jsonb; -- {types:['truth','dare'], intensity, forbidden, environment}

-- AI 生成过的题目，存库复用（省 token）。非机密，服务端读写。
create table if not exists td_library (
  id uuid primary key default gen_random_uuid(),
  kind text not null,        -- truth | dare
  intensity text,            -- mild | medium | bold
  text text not null,
  created_at timestamptz not null default now()
);
alter table td_library enable row level security;
-- 仅服务端读写（由 /api/td/draw 提供给玩家）。
create index if not exists td_library_kind_idx on td_library(kind, intensity);

-- ---------- 15. 跑团深度强化：世界时钟 / NPC 自主 / 资源稀缺 / 线索推理 ----------
-- 世界时钟：案件随回合自行推进的定时事件（仪式倒计时、潮水上涨、凶手转移尸体…）。
-- 即使玩家不动，世界也会到点变化，制造真实的时间压力。
alter table rooms add column if not exists world_clock jsonb not null default '[]'::jsonb;
-- 形如 [{ "id":"ritual","label":"祭坛的低语越来越响","due_round":8,"hidden":true,"fired":false,"on_fire":"仪式完成，门开了" }]
alter table rooms add column if not exists deduction_count int not null default 0;

-- NPC 自主与记忆：NPC 有自己的目标、秘密、对玩家的态度与记忆，会主动行动、记仇、改口。
alter table npcs add column if not exists goal text;            -- 这个 NPC 当下想要什么
alter table npcs add column if not exists secret text;          -- 他藏着的秘密（KP 侧）
alter table npcs add column if not exists memory text;          -- 与玩家互动的滚动记忆
alter table npcs add column if not exists relationships jsonb not null default '{}'::jsonb; -- {"A":0,"B":0} 态度 -3..+3
alter table npcs add column if not exists last_seen_turn int;
-- npcs.status 已存在（存活/受伤/逃走/死亡 等文字描述）

-- 资源稀缺：弹药 / 光源等可耗尽资源，让"打不打、点不点灯"成为有重量的决定。
alter table characters add column if not exists resources jsonb not null default '{}'::jsonb; -- {"弹药":6,"手电电量":5}

-- 线索推理：标记由玩家主动拼合两条以上线索得出的"推理结论"。
alter table clues add column if not exists kind text not null default 'clue'; -- clue | deduction

-- 重建前端线索视图：补上 kind，仍然裁掉 is_key/is_red_herring 等真相元标记。
drop view if exists clues_player;
create view clues_player with (security_invoker = true) as
  select id, room_id, title, description, source, visible_to, discovered_turn, created_at, thread, kind
  from clues;
grant select on clues_player to anon, authenticated;

-- 让 NPC 与线索变化也走实时（关系/态度更新能即时反映）。
do $$ begin
  alter publication supabase_realtime add table npcs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table clues;
exception when duplicate_object then null; end $$;

-- 完成。刷新网页即可。
