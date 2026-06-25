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

-- ---------- 16. 账号 / 局数额度 / 白名单（开房收费）----------
-- 访客（被邀请加入）始终免费、可匿名；只有"自己开房当主持"才需要登录并有额度。
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits int not null default 0,                 -- 剩余可开房局数
  is_whitelisted boolean not null default false,  -- 永久免费（不消耗额度）
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists free_granted boolean not null default false; -- 是否已发过一次性免费额度
alter table profiles enable row level security;
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select using (auth.uid() = user_id or is_admin());
-- 不开放 insert/update 策略：仅服务端 service_role 写（购买充值 / 开房扣额度）。

-- 永久免费白名单（按邮箱）。把下面换成你 Google 登录用的邮箱：
create table if not exists whitelist_emails (email text primary key);
insert into whitelist_emails(email) values ('yxhzdm@gmail.com') on conflict do nothing;
insert into whitelist_emails(email) values ('hattieichinose@gmail.com') on conflict do nothing;

-- Stripe webhook 去重：同一事件只充值一次。
create table if not exists billing_events (
  id text primary key,
  created_at timestamptz not null default now()
);
alter table billing_events enable row level security;
alter table profiles enable row level security;

-- ---------- 17. 多语言：每个房间一种语言（中文 / 英文），AI 内容按此生成 ----------
alter table rooms add column if not exists language text not null default 'zh'; -- zh | en

-- ---------- 18. 剧本杀模式（多人本格推理 / 情感 / 阵营 / 恐怖 / 还原 等本型）----------
-- rooms.mode 现可为 coc | soup | td | jbs
alter table rooms add column if not exists jbs_act int not null default 0;       -- 当前幕（1~7）
alter table rooms add column if not exists jbs_options jsonb;                     -- 3 个候选剧本
alter table rooms add column if not exists jbs_phase text;                        -- script|locking|playing|vote|revealing|reveal
alter table rooms add column if not exists jbs_resources jsonb;                   -- 机制本：各角色资源/分数快照
alter table rooms add column if not exists jbs_act_turns int not null default 0;  -- 本幕已进行的玩家回合数（备用）
alter table rooms add column if not exists jbs_act_minutes int not null default 6; -- 每幕时长（分钟），到点自动推进
alter table rooms add column if not exists jbs_act_started_at timestamptz;         -- 本幕开始的真实时间（用于倒计时）
alter table rooms add column if not exists jbs_total_acts int not null default 7;  -- 本剧总幕数（5~8，按剧本生成）
alter table rooms add column if not exists jbs_act_names jsonb;                    -- 各幕公开幕名（前端显示用，不含剧透）

-- 隐藏案件档案（含真相 + 全部角色秘密），仅 service_role 可读写
create table if not exists jbs_cases (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  type text,            -- 推理/情感/欢乐/阵营/恐怖/还原
  title text,
  headcount int,        -- 推荐人数
  meter_key text,       -- 结算面板：推理值/情感值/欢乐值/阵营值/恐惧值/还原度
  case_file jsonb not null,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table jbs_cases enable row level security;
-- 不开放 anon/authenticated 策略：含真相，仅服务端读写。

-- 角色（真人座位 A/B + AI 补位）。仅公开字段前端可见；秘密/目标留在 case_file，由私信下发本人。
create table if not exists jbs_characters (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text, age text, occupation text, public_info text,
  gender text,
  is_ai boolean not null default false,
  assigned_seat text,   -- 'A'/'B'，AI 为 null
  faction text,         -- 阵营本用
  status text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table jbs_characters add column if not exists gender text; -- 配音按性别选嗓音
alter table jbs_characters enable row level security;
drop policy if exists jbs_char_read on jbs_characters;
create policy jbs_char_read on jbs_characters for select using (is_room_member(room_id) or is_admin());

-- 最终指认/投票
create table if not exists jbs_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  voter text,   -- 'A'/'B' 或 AI 角色名
  target text,  -- 被指认的角色名
  created_at timestamptz not null default now()
);
alter table jbs_votes enable row level security;
drop policy if exists jbs_vote_read on jbs_votes;
create policy jbs_vote_read on jbs_votes for select using (is_room_member(room_id) or is_admin());

do $$ begin alter publication supabase_realtime add table jbs_characters; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table jbs_votes; exception when duplicate_object then null; end $$;

-- ---------- 19. 剧本杀 1–8 人：放开座位约束 + 按座位的私密可见性 ----------
-- 座位从 A/B 扩到 A–H（CoC/真心话仍只用 A/B；剧本杀可容纳最多 8 名真人）。
alter table players drop constraint if exists players_seat_check;
alter table players add constraint players_seat_check check (seat in ('A','B','C','D','E','F','G','H'));

-- 消息按座位私密：visibility='seat:X' 只对座位 X 的玩家可见（保留 player_a/player_b 兼容 CoC 旧数据）。
drop policy if exists messages_member_read on messages;
create policy messages_member_read on messages for select using (
  is_admin() or (
    is_room_member(room_id) and (
      visibility = 'public'
      or (visibility = 'player_a' and my_seat(room_id) = 'A')
      or (visibility = 'player_b' and my_seat(room_id) = 'B')
      or (visibility like 'seat:%' and my_seat(room_id) = substring(visibility from 6))
    )
  )
);

-- ---------- 20. CoC 最多 6 人：放开私密线索的座位约束（座位本身已在第 19 节放开到 A–H）----------
alter table clues drop constraint if exists clues_visible_to_check;
alter table clues add constraint clues_visible_to_check check (visible_to in ('all','A','B','C','D','E','F','G','H'));

-- ---------- 21. 血染模式（社交推理，类狼人杀；AI 说书人 + AI 补位；4/6/8 人局，真人 1~8，真人也可为邪恶方）----------
-- rooms.mode 现可为 coc | soup | td | jbs | botc
alter table rooms add column if not exists botc_phase text;                  -- lobby|day|reveal
alter table rooms add column if not exists botc_day int not null default 0;  -- 第几天
alter table rooms add column if not exists botc_size int not null default 6; -- 本局总人数 4/6/8

-- 隐藏设置（全部身份/阵营/恶魔/中毒/胜负，仅 service_role 可读写）
create table if not exists botc_setup (
  room_id uuid primary key references rooms(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table botc_setup enable row level security;
-- 不开放 anon/authenticated 策略：含全部隐藏身份，仅服务端读写。

-- 公开玩家板（仅座位/昵称/存活，不含身份；房间成员可读）
create table if not exists botc_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  seat text,                 -- A..H；AI 为 null
  display_name text,
  is_ai boolean not null default false,
  alive boolean not null default true,
  used_ghost_vote boolean not null default false,
  created_at timestamptz not null default now()
);
alter table botc_players enable row level security;
drop policy if exists botc_players_read on botc_players;
create policy botc_players_read on botc_players for select using (is_room_member(room_id) or is_admin());

-- 提名/投票（每天一轮）
create table if not exists botc_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  day int not null default 1,
  voter text,    -- 座位（A..H）或 AI 角色名
  target text,   -- 被指认的座位/名字；'skip' 表示弃票
  created_at timestamptz not null default now()
);
alter table botc_votes enable row level security;
drop policy if exists botc_votes_read on botc_votes;
create policy botc_votes_read on botc_votes for select using (is_room_member(room_id) or is_admin());

do $$ begin alter publication supabase_realtime add table botc_players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table botc_votes; exception when duplicate_object then null; end $$;

-- 夜间行动（逐角色叫醒：真人对自己能力的目标选择；保密，仅 service_role 可读）
create table if not exists botc_night (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  day int not null,
  actor text,    -- 座位 A..H
  action text,   -- kill | poison | protect
  target text,   -- 目标座位/名字
  created_at timestamptz not null default now()
);
alter table botc_night enable row level security;
-- 不开放任何 anon/authenticated 读策略：夜间行动保密，仅服务端读写。

-- ---------- 22. Midnight Cat Curse（原创"赌运气"猫主题派对牌游戏；2~6 真人，无 AI）----------
-- rooms.mode 现可为 coc | soup | td | jbs | botc | mcc
alter table rooms add column if not exists mcc_phase text; -- lobby|playing|ended

-- 完整对局状态（含牌堆顺序与各家手牌，机密，仅 service_role 可读写）
create table if not exists mcc_games (
  room_id uuid primary key references rooms(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table mcc_games enable row level security;
-- 不开放任何 anon/authenticated 读策略：含牌堆顺序与他人手牌。

-- 公开桌面快照（牌堆数量/弃牌堆顶/各家手牌数/当前回合/日志，房间成员可读）
create table if not exists mcc_public (
  room_id uuid primary key references rooms(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table mcc_public enable row level security;
drop policy if exists mcc_public_read on mcc_public;
create policy mcc_public_read on mcc_public for select using (is_room_member(room_id) or is_admin());

-- 每名玩家的手牌（仅本人可读）
create table if not exists mcc_hands (
  room_id uuid not null references rooms(id) on delete cascade,
  seat text not null,
  cards jsonb not null default '[]'::jsonb,
  primary key (room_id, seat)
);
alter table mcc_hands enable row level security;
drop policy if exists mcc_hands_read on mcc_hands;
create policy mcc_hands_read on mcc_hands for select using (seat = my_seat(room_id) or is_admin());

do $$ begin alter publication supabase_realtime add table mcc_public; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table mcc_hands; exception when duplicate_object then null; end $$;

-- 完成。刷新网页即可。

-- ---------- 自动关闭闲置房间：心跳列 ----------
-- 玩家开着房间页时每分钟更新 last_active；超过 5 分钟无人 → 后台自动把房间设为 ended。
alter table rooms add column if not exists last_active timestamptz not null default now();
create index if not exists idx_rooms_last_active on rooms (game_state, last_active);

-- ---------- 龙与地下城（D&D）模式 ----------
-- 单张共享状态表：队伍角色卡 / 场景 / 战斗（先攻、怪物 HP/AC）/ 日志。成员可读，服务端（route）写。
alter table rooms add column if not exists dnd_phase text; -- lobby|creation|explore|combat|ended
create table if not exists dnd_state (
  room_id uuid primary key references rooms(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table dnd_state enable row level security;
drop policy if exists dnd_state_read on dnd_state;
create policy dnd_state_read on dnd_state for select using (is_room_member(room_id) or is_admin());
do $$ begin alter publication supabase_realtime add table dnd_state; exception when duplicate_object then null; end $$;

-- ---------- 剧本杀：本型（非剧透，给前端按本型分流结局机制） ----------
alter table rooms add column if not exists jbs_type text; -- 推理|情感|欢乐|阵营|恐怖|还原|机制

-- ---------- 剧本杀：结构化任务/目标系统（私有，可勾选，DM 裁定完成度） ----------
create table if not exists jbs_objectives (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  seat text not null,
  idx int not null,
  kind text,                                   -- task|goal|faction
  text text not null,
  status text not null default 'pending',      -- pending|progress|done|failed
  note text,
  updated_at timestamptz default now()
);
alter table jbs_objectives enable row level security;
drop policy if exists jbs_obj_read on jbs_objectives;
create policy jbs_obj_read on jbs_objectives for select using (seat = my_seat(room_id) or is_admin());
do $$ begin alter publication supabase_realtime add table jbs_objectives; exception when duplicate_object then null; end $$;

-- ---------- D&D：冒险选项（像 CoC/剧本杀那样先三选一 + 自定义） ----------
alter table rooms add column if not exists dnd_options jsonb;

-- ---------- D&D：冒险库（达标蓝图归档复用，省 token） ----------
create table if not exists dnd_library (
  id uuid primary key default gen_random_uuid(),
  title text, setting text, hook text, tone text, threat text, length text,
  data jsonb not null,        -- { scene, quest, blueprint, opening, options }（含反转/Boss，机密）
  quality jsonb,              -- 质量评分
  passed boolean not null default false,
  times_used int not null default 0,
  created_at timestamptz not null default now()
);
alter table dnd_library enable row level security;
-- 不创建任何 anon/authenticated 策略：含反转/反派，仅服务端 service_role 可读写。
create index if not exists dnd_library_passed_idx on dnd_library(passed, created_at);

-- ---------- 讲故事模式（给特别的人讲一个 10 分钟故事） ----------
alter table rooms add column if not exists story_phase text; -- setup|generating|select|reading
create table if not exists story_state (
  room_id uuid primary key references rooms(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table story_state enable row level security;
drop policy if exists story_state_read on story_state;
create policy story_state_read on story_state for select using (is_room_member(room_id) or is_admin());
do $$ begin alter publication supabase_realtime add table story_state; exception when duplicate_object then null; end $$;

-- ===== section: 讲故事 · 精选故事库（评分≥85自动入库，优先推荐） =====
create table if not exists story_library (
  id uuid primary key default gen_random_uuid(),
  title text, genre text, logline text, mood text,
  est_minutes int default 10,
  genres jsonb, tone text,
  story text not null,
  rating jsonb,
  overall numeric,
  times_used int not null default 0,
  created_at timestamptz not null default now()
);
alter table story_library enable row level security;
create index if not exists story_library_overall_idx on story_library(overall desc, created_at desc);
-- 玩家对每个游戏的留言 / 反馈。
create table if not exists game_feedback (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  name text,
  rating int,
  message text not null,
  created_at timestamptz default now()
);
alter table game_feedback enable row level security;
drop policy if exists game_feedback_read on game_feedback;
create policy game_feedback_read on game_feedback for select using (true);
create index if not exists idx_game_feedback_slug on game_feedback(game_slug, created_at desc);
-- AI 生成的博客文章（管理员博客生成器写入）。
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  lang text not null default 'zh',
  title text not null,
  excerpt text,
  body_html text not null,
  score numeric,
  published boolean default true,
  created_at timestamptz default now()
);
alter table blog_posts enable row level security;
drop policy if exists blog_posts_read on blog_posts;
create policy blog_posts_read on blog_posts for select using (published = true);
create index if not exists idx_blog_posts_lang on blog_posts(lang, created_at desc);

-- ===== 博客改为同一 slug 可有中英两版（发布自动出双语） =====
alter table blog_posts drop constraint if exists blog_posts_slug_key;
create unique index if not exists blog_posts_slug_lang on blog_posts(slug, lang);
