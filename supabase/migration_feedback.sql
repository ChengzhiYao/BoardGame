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
