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
