// 博客文章（中英双语），用于打长尾词、带自然流量。
export type Post = {
  slug: string; date: string;
  zh: { title: string; excerpt: string; html: string };
  en: { title: string; excerpt: string; html: string };
};

export const POSTS: Post[] = [
  {
    slug: 'what-is-ai-murder-mystery', date: '2026-06-20',
    zh: {
      title: 'AI 剧本杀是什么？和传统剧本杀有什么不同',
      excerpt: 'AI 剧本杀就是让人工智能当主持人（DM），现场生成一桩真相锁定的案子并扮演所有嫌疑人。两个人、甚至一个人就能玩，每局都不一样。',
      html: '<p>传统剧本杀很好玩，但门槛不低：要买本子、约齐六个人、还得有人读一小时主持手册。<strong>AI 剧本杀</strong>把这些都省了——人工智能当主持人，现场为你们现编一桩完整自洽、真相被锁定的案子，并扮演所有会撒谎、会甩锅的嫌疑人。</p><h2>和传统剧本杀的三个区别</h2><p><strong>1. 两个人就能开局。</strong> 大多数剧本杀低于 4–6 人就玩不转，AI 会补满其余角色，所以两个人、甚至一个人都能完整体验。</p><p><strong>2. 不用人当主持。</strong> AI 知道真相、把控七幕节奏、绝不剧透，也绝不替真人发言。</p><p><strong>3. 永远不重样。</strong> 每个案子都是现场生成的，凶手、动机、时间线、证据每局都不同，玩过也不知道下一局答案。</p><p>想试试的话，<a href="/games/murder-mystery">看剧本杀玩法详情</a>，或直接<a href="/#games">开一局</a>。</p>',
    },
    en: {
      title: 'What is an AI murder mystery — and how is it different?',
      excerpt: 'An AI murder mystery lets an artificial intelligence host the game: it generates a locked case and plays every suspect, so two people — or even one — can play, and no two games are the same.',
      html: '<p>Classic murder mystery kits are great, but the bar is high: buy the box, schedule six people, and read an hour of host notes. An <strong>AI murder mystery</strong> removes all of that — an AI hosts, generates a complete, self-consistent, locked case on the spot, and plays every lying, scheming suspect.</p><h2>Three differences from a traditional kit</h2><p><strong>1. Two players are enough.</strong> Most mysteries fall apart below 4–6 players; the AI fills the rest, so two people (or even one) get the full experience.</p><p><strong>2. No human host needed.</strong> The AI knows the truth, paces the seven acts, never spoils it and never speaks for real players.</p><p><strong>3. It never repeats.</strong> Every case is generated live — culprit, motive, timeline and evidence change each time.</p><p>Want to try it? <a href="/games/murder-mystery">See how the murder mystery works</a>, or <a href="/#games">start a game</a>.</p>',
    },
  },
  {
    slug: 'tabletop-games-for-two', date: '2026-06-22',
    zh: {
      title: '两个人能玩的桌游推荐（有 AI 主持，随时开局）',
      excerpt: '情侣、室友、异地朋友想玩桌游，却凑不齐人？这几种有 AI 主持的玩法，两个人就能开，而且每局都不一样。',
      html: '<p>大部分桌游都要一桌人，两个人的晚上反而没什么可玩。下面这几种<strong>两个人就能玩</strong>的玩法都有 AI 主持，随时能开：</p><h2>适合两人的几种玩法</h2><p><strong>剧本杀：</strong> AI 当主持 + 补满嫌疑人，双人也能完整推理。<a href="/games/murder-mystery">详情</a>。</p><p><strong>克苏鲁调查：</strong> 一场有理智值和骰子的恐怖探案，氛围拉满。<a href="/games/cthulhu">详情</a>。</p><p><strong>海龟汤：</strong> 一个守着诡异谜底、靠是非题逼近真相的小游戏，十几分钟一局。<a href="/games/lateral-thinking">详情</a>。</p><p><strong>午夜猫诅咒：</strong> 原创卡牌，10–20 分钟一局，节奏快。<a href="/games/midnight-cat-curse">详情</a>。</p><p>全部都能<a href="/#games">现在就开一局</a>，发个链接朋友点开就进来了。</p>',
    },
    en: {
      title: 'Tabletop games for two players (AI-hosted, play anytime)',
      excerpt: 'Couples, roommates and long-distance friends who want a game night but can not gather a crowd — these AI-hosted formats work great for two, and never play out the same way.',
      html: '<p>Most board games want a full table, which leaves a two-person evening short on options. These <strong>two-player-friendly</strong> formats all have an AI host and start on demand:</p><h2>Great picks for two</h2><p><strong>Murder mystery:</strong> the AI hosts and fills the suspects, so two people get a full whodunit. <a href="/games/murder-mystery">Details</a>.</p><p><strong>Cthulhu investigation:</strong> a horror case with sanity and dice, heavy on atmosphere. <a href="/games/cthulhu">Details</a>.</p><p><strong>Lateral thinking soup:</strong> a yes/no riddle the AI guards, 15 minutes a round. <a href="/games/lateral-thinking">Details</a>.</p><p><strong>Midnight Cat Curse:</strong> an original card game, fast 10–20 minute rounds. <a href="/games/midnight-cat-curse">Details</a>.</p><p>You can <a href="/#games">start any of them now</a> — just share the link and your friend is in.</p>',
    },
  },
  {
    slug: 'what-is-lateral-thinking-soup', date: '2026-06-24',
    zh: {
      title: '海龟汤是什么？怎么玩（附 AI 出题）',
      excerpt: '海龟汤是一种情境推理游戏：主持人给出一个诡异情境，你只能问是非题，一点点还原真相。现在 AI 能当那个永不剧透的主持人。',
      html: '<p><strong>海龟汤</strong>（情境推理 / lateral thinking puzzle）是一种问答推理游戏：主持人给出一个看似诡异、不合常理的「汤面」，玩家只能问<strong>是非题</strong>，靠主持人「是 / 不是 / 无关」的回答，一点点把完整真相（汤底）还原出来。</p><h2>怎么玩</h2><p>① 主持人给出汤面；② 玩家轮流提是非题；③ 主持人只答是非；④ 有人想到汤底就揭晓。</p><h2>为什么适合 AI 主持</h2><p>海龟汤最难的是主持人要<strong>守住秘密、对任意提问保持逻辑一致几十轮不说漏嘴</strong>。AI 正好擅长这件事，而且能无限出新题。<a href="/games/lateral-thinking">看海龟汤详情</a>，或<a href="/#games">来一道</a>。</p>',
    },
    en: {
      title: 'What is a lateral thinking puzzle (soup game)? How to play',
      excerpt: 'A lateral thinking puzzle is a deduction game: the host gives a strange scenario and you ask only yes/no questions to reconstruct the truth. An AI makes a perfect, never-spoiling host.',
      html: '<p>A <strong>lateral thinking puzzle</strong> (also called a "soup" game, or umikame) is a question-and-answer deduction game: the host presents a strange, seemingly impossible scenario, and players ask only <strong>yes/no questions</strong>, using the host\'s "yes / no / irrelevant" answers to reconstruct the full truth.</p><h2>How to play</h2><p>① The host gives the scenario; ② players take turns asking yes/no questions; ③ the host answers only yes/no; ④ reveal once someone has the full solution.</p><h2>Why it suits an AI host</h2><p>The hard part is that the host must <strong>guard the secret and stay logically consistent over dozens of arbitrary questions without leaking</strong> — exactly what an AI is good at, and it can generate endless fresh puzzles. <a href="/games/lateral-thinking">See the soup game</a>, or <a href="/#games">try one</a>.</p>',
    },
  },
];

export const post = (slug: string) => POSTS.find((p) => p.slug === slug);
