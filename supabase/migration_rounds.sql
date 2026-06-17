-- =====================================================================
-- 迁移：双人回合制 + 消息可见性。在 Supabase → SQL Editor 执行。
-- =====================================================================

-- 回合收集状态
alter table rooms add column if not exists current_round int not null default 1;
alter table rooms add column if not exists pending_actions jsonb not null default '{}'::jsonb; -- {"A":{"content":"","action_type":""},"B":{...}}
alter table rooms add column if not exists player_a_ready boolean not null default false;
alter table rooms add column if not exists player_b_ready boolean not null default false;
alter table rooms add column if not exists waiting_for text;          -- 'A' | 'B' | 'both' | null
alter table rooms add column if not exists resolution_status text not null default 'collecting'; -- collecting | resolving

-- 消息可见性：公共 / 仅A / 仅B（私人事件、私人SAN幻觉）
alter table messages add column if not exists visibility text not null default 'public'; -- public | player_a | player_b

-- 重建消息读取策略：私人消息只发给对应座位
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
