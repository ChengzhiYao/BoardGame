-- =====================================================================
-- 迁移：引入 10 状态的强制流程状态机（game_state）+ 模组存储。
-- 在 Supabase → SQL Editor 整段执行。可重复执行（IF NOT EXISTS）。
-- =====================================================================

-- 房间状态机字段
alter table rooms add column if not exists game_state text not null default 'lobby';
-- 取值：lobby / module_selection / case_locking / character_creation /
--       attribute_allocation / skill_allocation / character_confirmation /
--       rule_briefing / playing / ended

-- AI 生成的 3 个模组选项（玩家可见，不含真相）
alter table rooms add column if not exists module_options jsonb;
-- 玩家的自定义模组方向（恐怖类型/时代/地点/风格/禁止内容/难度/时长）
alter table rooms add column if not exists custom_direction jsonb;
-- 模组生成进行中标记（防并发重复生成）
alter table rooms add column if not exists modules_generating boolean not null default false;

-- 角色确认标记
alter table characters add column if not exists confirmed boolean not null default false;

-- 把已存在的老房间迁移到新状态：
-- waiting→lobby，character_creation→character_creation，playing→playing，ended→ended
update rooms set game_state =
  case status
    when 'waiting' then 'lobby'
    when 'character_creation' then 'character_creation'
    when 'playing' then 'playing'
    when 'ended' then 'ended'
    else 'lobby'
  end
where game_state is null or game_state = 'lobby';
