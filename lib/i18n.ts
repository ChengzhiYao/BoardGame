// 多语言：UI 文案字典 + AI 输出语言指令 + 客户端语言读写。
// 语言来源：开房前用 cookie/localStorage（落地页开关写入）；游戏内用 room.language（两名玩家一致）。
export type Lang = 'zh' | 'en';

// 给 LLM 的输出语言指令：拼到 system prompt 末尾即可控制面向玩家的输出语言。
export function langDirective(lang?: string): string {
  if (lang === 'en') {
    return `\n\n【OUTPUT LANGUAGE = ENGLISH】Write ALL player-facing text in natural, fluent ENGLISH — narration, clues (title & description), NPC names and dialogue, locations, guidance (location/goal/investigables/options), timeline, endings, questions, hints. Do NOT output Chinese in any field. Keep the JSON structure and keys EXACTLY as specified (keys stay in their given form). Atmospheric, idiomatic English horror prose.`;
  }
  return ''; // 默认中文，prompt 本身就是中文
}

// ---- 客户端语言读写（仅浏览器）----
export function getClientLang(): Lang {
  if (typeof document === 'undefined') return 'en';
  // 1) 用户手动选过 → 用保存的
  const m = document.cookie.match(/(?:^|;\s*)lang=(zh|en)/);
  if (m) return m[1] as Lang;
  try { const l = localStorage.getItem('lang'); if (l === 'en' || l === 'zh') return l; } catch {}
  // 2) 没选过 → 按浏览器语言自动识别：中文浏览器用中文，其余默认英文
  try {
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) || [];
    if (langs.some((x) => /^zh/i.test(x || ''))) return 'zh';
  } catch {}
  return 'en';
}
export function setClientLang(l: Lang) {
  try { localStorage.setItem('lang', l); } catch {}
  if (typeof document !== 'undefined') document.cookie = `lang=${l}; path=/; max-age=31536000`;
}

// ---- 文案字典 ----
type Dict = Record<string, string>;
const ZH: Dict = {
  back: '返回', cancel: '取消', confirm: '确认', submit: '提交', loading: '加载中…', retry: '重试',
  home_title: '谜夜',
  home_tagline: '叫上朋友，两个人就能开局。AI 当主持人，实时给你们编一场只属于今晚的故事——剧本杀、推理探案、海龟汤，每一局都不一样。',
  home_name_ph: '你的昵称',
  mode_coc: '调查跑团（CoC）', mode_soup: '海龟汤', mode_td: '真心话大冒险', mode_jbs: '剧本杀', mode_botc: '血染（社交推理）',
  create_coc: '创建调查', create_soup: '创建海龟汤', create_td: '创建真心话大冒险', create_jbs: '创建剧本杀', create_botc: '创建血染',
  starting: '正在开启…', join_btn: '输入邀请码加入', join_code_ph: '粘贴邀请码', join_do: '加入', joining: '正在加入…',
  err_name: '先填个昵称', err_code: '粘贴邀请码',
  home_upgrade_link: '开房说明 · 我的局数 →',
  login_google: 'Google 登录', logout: '退出', free_forever: '永久免费', credits_left: '局',
  up_title: '开房 · 购买局数',
  up_desc1a: '为了还原真实的跑团体验，这里的', up_desc1b: '每一句剧情、每一条线索、每一个 NPC 都由高额智能 AI 实时生成', up_desc1c: '——没有固定脚本，世界随你的每一个选择而变。这背后是真金白银的算力成本，所以', up_desc1d: '开房当主持需要购买局数', up_desc1e: '来维持运转。',
  up_desc2a: '局数对所有模式通用：克苏鲁调查跑团 · 海龟汤 · 真心话大冒险，开房各消耗 1 局。', up_desc2b: '被你邀请进房的朋友始终免费游玩，无需登录或付费。',
  up_login_buy: '用 Google 登录后购买', up_reading: '读取账号中…', up_buy: '购买', up_login_then: '登录后购买', up_redirect: '跳转支付…', up_already_free: '你已永久免费',
  up_paying_open: '支付成功，正在为你开房…', up_no_redirect_a: '若几秒后没有自动跳转，', up_no_redirect_b: '点此返回首页开房', up_no_redirect_c: '。',
  up_back_home: '← 返回首页',
  st_lobby: '大厅', st_module: '选模组', st_lock: '锁定真相', st_char: '建卡', st_attr: '属性', st_skill: '技能', st_confirm: '确认', st_brief: '规则', st_play: '调查中', st_end: '结局',
  dash_round: '第 {n} 回合', dash_img_budget: '配图额度',
  tab_story: '剧情', tab_chars: '角色', tab_clues: '调查',
  kp: '守秘人', resolving: '守秘人正在结算本回合……',
  input_ph: '描述行动 / 说话…', ended_input_ph: '调查已结束',
  btn_chat: '对话', btn_submit: '提交行动', you: '你',
  submitted: '已提交行动：', withdraw: '撤回 / 修改', resolving_short: '结算中…',
  out_notice: '你的调查员已退场（死亡或永久疯狂），无法再行动。　由同伴继续，或等待结局。',
  guide_hint: '在下方描述你的行动，点「提交行动」开始调查。两人都提交后，守秘人会给出后续的地点、目标与可调查对象。',
  panel_scene: '场景', panel_clue: '线索板', panel_npc: 'NPC',
  scene_empty: '关键时刻，影像将在此浮现。', clue_empty: '尚无线索。展开调查吧。', npc_empty: '还没遇见任何人。',
  deduce_btn: '🧩 拼合推理（已选 {n}）', deduce_hint: '勾选 2 条以上线索，试着推出新结论。', deducing: '推理中…',
  clock_flow: '⏳ 时间在流逝', rounds_left: '约 {n} 回合',
  ended_banner: '调查结束 · 真相已可揭晓', view_recap: '查看真相与复盘',
};
const EN: Dict = {
  back: 'Back', cancel: 'Cancel', confirm: 'Confirm', submit: 'Submit', loading: 'Loading…', retry: 'Retry',
  home_title: 'MystNight',
  home_tagline: 'Grab a friend — two people are enough to start. An AI host spins up a story made just for tonight: murder mysteries, detective cases, lateral-thinking puzzles. No two games are ever the same.',
  home_name_ph: 'Your name',
  mode_coc: 'Investigation (CoC)', mode_soup: 'Lateral Mystery', mode_td: 'Truth or Dare', mode_jbs: 'Murder Mystery', mode_botc: 'Bloodbound (social deduction)',
  create_coc: 'Create Investigation', create_soup: 'Create Mystery', create_td: 'Create Truth or Dare', create_jbs: 'Create Murder Mystery', create_botc: 'Create Bloodbound',
  starting: 'Opening…', join_btn: 'Join with invite code', join_code_ph: 'Paste invite code', join_do: 'Join', joining: 'Joining…',
  err_name: 'Enter your name first', err_code: 'Paste the invite code',
  home_upgrade_link: 'Hosting & my credits →',
  login_google: 'Sign in with Google', logout: 'Sign out', free_forever: 'Free forever', credits_left: 'left',
  up_title: 'Hosting · Buy Credits',
  up_desc1a: 'To recreate a truly live tabletop experience, ', up_desc1b: 'every line of story, every clue, every NPC is generated in real time by a high-end AI', up_desc1c: ' — no fixed script, the world shifts with your every choice. That runs on real compute cost, so ', up_desc1d: 'hosting a game requires credits', up_desc1e: ' to keep it running.',
  up_desc2a: 'Credits work for every mode: Cthulhu Investigation · Lateral Mystery · Truth or Dare — hosting costs 1 credit each. ', up_desc2b: 'Friends you invite always play for free, no login or payment needed.',
  up_login_buy: 'Sign in with Google to buy', up_reading: 'Loading account…', up_buy: 'Buy', up_login_then: 'Sign in to buy', up_redirect: 'Redirecting…', up_already_free: 'You’re free forever',
  up_paying_open: 'Payment received — opening your game…', up_no_redirect_a: 'If it doesn’t redirect in a few seconds, ', up_no_redirect_b: 'click here to go host', up_no_redirect_c: '.',
  up_back_home: '← Back home',
  st_lobby: 'Lobby', st_module: 'Module', st_lock: 'Lock Truth', st_char: 'Character', st_attr: 'Stats', st_skill: 'Skills', st_confirm: 'Confirm', st_brief: 'Rules', st_play: 'Investigating', st_end: 'Ending',
  dash_round: 'Round {n}', dash_img_budget: 'Image budget',
  tab_story: 'Story', tab_chars: 'Party', tab_clues: 'Inquiry',
  kp: 'Keeper', resolving: 'The Keeper is resolving this round…',
  input_ph: 'Describe an action / speak…', ended_input_ph: 'The investigation has ended',
  btn_chat: 'Talk', btn_submit: 'Submit action', you: 'You',
  submitted: 'Action submitted:', withdraw: 'Withdraw / edit', resolving_short: 'Resolving…',
  out_notice: 'Your investigator is out (dead or permanently insane) and can no longer act. Let your partner continue, or await the ending.',
  guide_hint: 'Describe your action below and hit “Submit action” to begin. Once both submit, the Keeper reveals the next location, goal and things to investigate.',
  panel_scene: 'Scene', panel_clue: 'Clue board', panel_npc: 'NPCs',
  scene_empty: 'In key moments, images will surface here.', clue_empty: 'No clues yet. Start investigating.', npc_empty: 'You haven’t met anyone yet.',
  deduce_btn: '🧩 Combine & deduce (selected {n})', deduce_hint: 'Check 2+ clues and try to deduce something new.', deducing: 'Deducing…',
  clock_flow: '⏳ Time is running', rounds_left: '~{n} rounds',
  ended_banner: 'Investigation over · the truth can be revealed', view_recap: 'View truth & recap',
};

const DICTS: Record<Lang, Dict> = { zh: ZH, en: EN };

export function tr(lang: Lang | undefined) {
  const d = DICTS[(lang as Lang) in DICTS ? (lang as Lang) : 'zh'];
  return (key: string, vars?: Record<string, string | number>) => {
    let s = d[key] ?? ZH[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
    return s;
  };
}
