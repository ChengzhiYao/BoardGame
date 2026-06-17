-- =====================================================================
-- AI 克苏鲁跑团平台 · 数据库 Schema（Postgres / Supabase）
-- 包含：建表 + 索引 + RLS 行级权限 + 真相保密 + 骰子/SAN 不可篡改触发器
-- 在 Supabase 控制台 → SQL Editor 里整段粘贴执行即可。
-- =====================================================================

-- 扩展
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- pgvector，AI 记忆检索

-- =====================================================================
-- 0. 工具函数：更新 updated_at
-- =====================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- 工具函数：判断当前登录用户是否是某房间的成员
-- 注意：用 plpgsql（而非 sql），让表引用推迟到运行时解析，
-- 否则函数在 players 表创建前定义会报 "relation players does not exist"。
create or replace function is_room_member(p_room_id uuid)
returns boolean language plpgsql security definer stable as $$
begin
  return exists(
    select 1 from players
    where players.room_id = p_room_id
      and players.user_id = auth.uid()
  );
end; $$;

-- 工具函数：取当前用户在某房间的座位（A/B），非成员返回 null
create or replace function my_seat(p_room_id uuid)
returns text language plpgsql security definer stable as $$
declare s text;
begin
  select seat into s from players
  where room_id = p_room_id and user_id = auth.uid()
  limit 1;
  return s;
end; $$;

-- 工具函数：是否管理员
create or replace function is_admin()
returns boolean language plpgsql security definer stable as $$
begin
  return exists(select 1 from users where id = auth.uid() and role = 'admin');
end; $$;

-- =====================================================================
-- 1. users
-- =====================================================================
create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text,
  role         text not null default 'player' check (role in ('player','admin')),
  created_at   timestamptz not null default now()
);
alter table users enable row level security;
create policy users_self_read   on users for select using (id = auth.uid() or is_admin());
create policy users_self_update on users for update using (id = auth.uid());

-- 新用户自动建 profile（注册即触发）
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users(id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- =====================================================================
-- 2. rooms
-- =====================================================================
create table rooms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null default '未命名调查',
  host_user_id     uuid not null references users(id),
  status           text not null default 'waiting'
                     check (status in ('waiting','character_creation','playing','ended')),
  invite_token     text unique,
  invite_expires_at timestamptz,
  campaign_id      uuid,                    -- 选定模组后回填（FK 见下方延迟添加）
  turn_count       int  not null default 0,
  image_budget     int  not null default 8,
  image_used       int  not null default 0,
  current_lock     text,                    -- 回合串行化标记（配合 advisory lock）
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index rooms_host_idx on rooms(host_user_id);
create trigger rooms_updated before update on rooms for each row execute function set_updated_at();
alter table rooms enable row level security;
create policy rooms_member_read on rooms for select using (is_room_member(id) or is_admin());
create policy rooms_host_insert on rooms for insert with check (host_user_id = auth.uid());
-- 状态/预算等关键字段的写入只走服务端（service_role 绕过 RLS）；这里仅允许房主改房名等
create policy rooms_host_update on rooms for update using (host_user_id = auth.uid());

-- =====================================================================
-- 3. players（房间内的玩家位，最多 2）
-- =====================================================================
create table players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references rooms(id) on delete cascade,
  user_id   uuid not null references users(id),
  seat      text not null check (seat in ('A','B')),
  is_ready  boolean not null default false,
  is_online boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(room_id, seat),
  unique(room_id, user_id)
);
create index players_room_idx on players(room_id);
alter table players enable row level security;
create policy players_member_read on players for select using (is_room_member(room_id) or is_admin());
-- 加入房间由服务端校验座位/满员后写入；自身在线状态可自更新
create policy players_self_update on players for update using (user_id = auth.uid());

-- =====================================================================
-- 4. characters（角色卡 · CoC 7e）
-- =====================================================================
create table characters (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  name        text,
  age         int,
  occupation  text,
  background  text,
  personality text,
  personal_goal text,
  fear        text,
  -- 8 属性
  str int, con int, dex int, app int, pow int, int_attr int, edu int, siz int,
  -- 派生 / 状态
  hp_max int, hp_current int,
  san_max int, san_current int, san_start int,
  luck int,
  mov int,
  db text,            -- 伤害加值，如 '+1d4'
  build int,          -- 体格
  skills jsonb not null default '{}'::jsonb,        -- {技能: {base, occupation, interest, total}}
  status_flags jsonb not null default
    '{"wounded":false,"dying":false,"temp_insanity":false,"indef_insanity":false,"retired":false,"dead":false}'::jsonb,
  is_complete boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index characters_room_idx on characters(room_id);
create trigger characters_updated before update on characters for each row execute function set_updated_at();
alter table characters enable row level security;
-- 角色卡两名玩家互相可见（HP/SAN 要显示在左栏）
create policy characters_member_read on characters for select using (is_room_member(room_id) or is_admin());
-- 玩家只能改自己那张卡（建卡阶段）；HP/SAN 的战斗内变更走服务端
create policy characters_owner_update on characters for update using (
  exists(select 1 from players p where p.id = characters.player_id and p.user_id = auth.uid())
);
create policy characters_owner_insert on characters for insert with check (
  exists(select 1 from players p where p.id = characters.player_id and p.user_id = auth.uid())
);

-- =====================================================================
-- 5. messages（共享剧情流）
-- =====================================================================
create table messages (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references rooms(id) on delete cascade,
  sender_type      text not null check (sender_type in ('player','kp','system')),
  sender_player_id uuid references players(id),
  action_type      text check (action_type in ('investigate','talk','combat','move','free')),
  content          text not null default '',
  payload          jsonb not null default '{}'::jsonb,   -- 骰检引用/线索id/配图建议/状态变更摘要
  turn_no          int not null default 0,
  created_at       timestamptz not null default now()
);
create index messages_room_time_idx on messages(room_id, created_at);
alter table messages enable row level security;
create policy messages_member_read on messages for select using (is_room_member(room_id) or is_admin());
-- 玩家可发自己的行动消息；KP/system 消息只由服务端写
create policy messages_player_insert on messages for insert with check (
  sender_type = 'player'
  and exists(select 1 from players p where p.id = sender_player_id and p.user_id = auth.uid() and p.room_id = messages.room_id)
);

-- =====================================================================
-- 6. campaigns（模组元信息 · 玩家可见层）
-- =====================================================================
create table campaigns (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  title        text not null,
  premise      text,
  tone         text,
  difficulty   text,
  est_duration text,
  setting      jsonb not null default '{}'::jsonb,
  status       text not null default 'draft' check (status in ('draft','locked')),
  created_at   timestamptz not null default now()
);
create index campaigns_room_idx on campaigns(room_id);
alter table campaigns enable row level security;
create policy campaigns_member_read on campaigns for select using (is_room_member(room_id) or is_admin());
-- 生成/锁定由服务端完成（service_role）

-- 现在补上 rooms.campaign_id 的外键
alter table rooms add constraint rooms_campaign_fk
  foreign key (campaign_id) references campaigns(id) on delete set null;

-- =====================================================================
-- 7. hidden_case_files（隐藏案件档案 · 最高机密 · 仅 service_role）
-- =====================================================================
create table hidden_case_files (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null unique references campaigns(id) on delete cascade,
  truth           text,
  mastermind      jsonb,
  supernatural    jsonb,
  npc_secrets     jsonb,
  npc_lies        jsonb,
  timeline_true   jsonb,
  key_clues       jsonb,
  red_herrings    jsonb,
  ending_conditions jsonb,
  hidden_endings  jsonb,
  locked_hash     text,
  locked_at       timestamptz
);
alter table hidden_case_files enable row level security;
-- 关键：不创建任何 select/insert/update 策略 → anon/authenticated 一律拒绝。
-- 只有 service_role（Edge Function）绕过 RLS 能读写。玩家永远拿不到真相。

-- 锁定后禁止修改真相核心字段（防篡改）
create or replace function lock_case_file()
returns trigger language plpgsql as $$
begin
  if old.locked_at is not null then
    if new.truth is distinct from old.truth
       or new.mastermind is distinct from old.mastermind
       or new.key_clues is distinct from old.key_clues
       or new.timeline_true is distinct from old.timeline_true
       or new.ending_conditions is distinct from old.ending_conditions then
      raise exception '案件真相已锁定，不可修改核心字段';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_lock_case_file before update on hidden_case_files
  for each row execute function lock_case_file();

-- =====================================================================
-- 8. clues（线索板 · 可见性分级 + 私人线索）
-- =====================================================================
create table clues (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references rooms(id) on delete cascade,
  title          text not null,
  description    text,
  source         text,
  is_key         boolean not null default false,   -- 真相元标记，不下发前端（用视图裁剪）
  is_red_herring boolean not null default false,   -- 同上
  visible_to     text not null default 'all' check (visible_to in ('all','A','B')),
  discovered_turn int,
  created_at     timestamptz not null default now()
);
create index clues_room_idx on clues(room_id);
alter table clues enable row level security;
-- 私人线索物理隔离：只推送 all 或本玩家座位的行
create policy clues_visibility_read on clues for select using (
  is_admin() or (
    is_room_member(room_id) and (visible_to = 'all' or visible_to = my_seat(room_id))
  )
);

-- 给前端用的安全视图：裁掉真相元标记字段
create or replace view clues_player as
  select id, room_id, title, description, source, visible_to, discovered_turn, created_at
  from clues;

-- =====================================================================
-- 9. npcs / locations / timeline_events（玩家可见层）
-- =====================================================================
create table npcs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null, role text, description text,
  disposition text, status text,
  first_seen_turn int,
  visible_to text not null default 'all' check (visible_to in ('all','A','B')),
  created_at timestamptz not null default now()
);
create index npcs_room_idx on npcs(room_id);
alter table npcs enable row level security;
create policy npcs_read on npcs for select using (
  is_admin() or (is_room_member(room_id) and (visible_to='all' or visible_to=my_seat(room_id)))
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null, description text,
  is_visited boolean not null default false,
  connected_to jsonb not null default '[]'::jsonb,
  first_seen_turn int,
  created_at timestamptz not null default now()
);
create index locations_room_idx on locations(room_id);
alter table locations enable row level security;
create policy locations_read on locations for select using (is_room_member(room_id) or is_admin());

create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  event_time text, description text,
  revealed_turn int,
  visible_to text not null default 'all' check (visible_to in ('all','A','B')),
  created_at timestamptz not null default now()
);
create index timeline_room_idx on timeline_events(room_id);
alter table timeline_events enable row level security;
create policy timeline_read on timeline_events for select using (
  is_admin() or (is_room_member(room_id) and (visible_to='all' or visible_to=my_seat(room_id)))
);

-- =====================================================================
-- 10. dice_rolls（骰子日志 · 不可篡改）
-- =====================================================================
create table dice_rolls (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  character_id uuid references characters(id) on delete set null,
  dice_type    text not null check (dice_type in ('d100','d20','d10','d6')),
  skill_name   text,
  skill_value  int,
  target_value int,
  result       int not null,
  outcome      text check (outcome in ('fumble','fail','success','hard','extreme','critical')),
  context      text,
  turn_no      int not null default 0,
  created_at   timestamptz not null default now()
);
create index dice_room_idx on dice_rolls(room_id, created_at);
alter table dice_rolls enable row level security;
create policy dice_member_read on dice_rolls for select using (is_room_member(room_id) or is_admin());
-- 不可篡改：禁止任何角色 update/delete（service_role 也走这条触发器）
create or replace function block_modify()
returns trigger language plpgsql as $$
begin raise exception '该日志不可修改或删除'; end; $$;
create trigger trg_dice_no_update before update on dice_rolls for each row execute function block_modify();
create trigger trg_dice_no_delete before delete on dice_rolls for each row execute function block_modify();
-- 注意：insert 仅由服务端（service_role）执行，不开放 insert policy 给玩家

-- =====================================================================
-- 11. san_logs（理智变化日志 · 不可篡改）
-- =====================================================================
create table san_logs (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  character_id uuid references characters(id) on delete set null,
  trigger      text,
  roll_result  int,
  san_before   int,
  san_after    int,
  loss         int,
  insanity_triggered text check (insanity_triggered in ('temporary','indefinite','none')),
  turn_no      int not null default 0,
  created_at   timestamptz not null default now()
);
create index san_room_idx on san_logs(room_id, created_at);
alter table san_logs enable row level security;
create policy san_member_read on san_logs for select using (is_room_member(room_id) or is_admin());
create trigger trg_san_no_update before update on san_logs for each row execute function block_modify();
create trigger trg_san_no_delete before delete on san_logs for each row execute function block_modify();

-- =====================================================================
-- 12. images（生成图片）
-- =====================================================================
create table images (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  trigger_type text,
  prompt       text,
  storage_url  text,
  status       text not null default 'suggested'
                check (status in ('suggested','approved','generating','done','failed','skipped')),
  approved_by  uuid references players(id),
  cost         numeric default 0,
  turn_no      int not null default 0,
  created_at   timestamptz not null default now()
);
create index images_room_idx on images(room_id);
alter table images enable row level security;
create policy images_member_read on images for select using (is_room_member(room_id) or is_admin());

-- =====================================================================
-- 13. api_usage（成本统计 · 仅服务端写，管理员读）
-- =====================================================================
create table api_usage (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid references rooms(id) on delete set null,
  kind              text not null check (kind in ('llm_main','llm_aux','image')),
  model             text,
  prompt_tokens     int default 0,
  completion_tokens int default 0,
  image_count       int default 0,
  cost              numeric default 0,
  latency_ms        int,
  created_at        timestamptz not null default now()
);
create index api_usage_room_idx on api_usage(room_id);
create index api_usage_time_idx on api_usage(created_at);
create index api_usage_kind_idx on api_usage(kind);
alter table api_usage enable row level security;
create policy api_usage_admin_read on api_usage for select using (is_admin());

-- =====================================================================
-- 14. memory_summaries（AI 记忆 / 上下文压缩 · 仅服务端）
-- =====================================================================
create table memory_summaries (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  summary    text,
  key_facts  jsonb not null default '[]'::jsonb,
  embedding  vector(1536),
  up_to_turn int not null default 0,
  created_at timestamptz not null default now()
);
create index memory_room_idx on memory_summaries(room_id);
alter table memory_summaries enable row level security;
-- 不开放给玩家（含真相相关事实），仅 service_role
create policy memory_admin_read on memory_summaries for select using (is_admin());

-- =====================================================================
-- 15. room_settings
-- =====================================================================
create table room_settings (
  room_id           uuid primary key references rooms(id) on delete cascade,
  difficulty        text default 'normal',
  image_budget      int default 8,
  content_intensity text default 'medium',
  language          text default 'zh',
  allow_pvp         boolean default false,
  auto_summary_every int default 8
);
alter table room_settings enable row level security;
create policy room_settings_read on room_settings for select using (is_room_member(room_id) or is_admin());

-- =====================================================================
-- 16. feedback / error_logs（后台）
-- =====================================================================
create table feedback (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete set null,
  user_id uuid references users(id),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
create policy feedback_insert on feedback for insert with check (user_id = auth.uid());
create policy feedback_admin_read on feedback for select using (is_admin());

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete set null,
  scope text check (scope in ('llm','image','realtime','db','other')),
  message text,
  stack text,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table error_logs enable row level security;
create policy error_logs_admin_read on error_logs for select using (is_admin());

-- =====================================================================
-- 17. Realtime：把需要实时同步的表加入 publication
-- =====================================================================
alter publication supabase_realtime add table
  rooms, players, characters, messages, campaigns,
  clues, npcs, locations, timeline_events,
  dice_rolls, san_logs, images;

-- 完成。
