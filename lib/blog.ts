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
  {
    slug: 'games-to-play-over-video-call', date: '2026-10-02',
    zh: { title: '视频通话时能一起玩的游戏（开个链接就能玩）', excerpt: '和朋友视频但不知道玩什么？这几种有 AI 主持的游戏，开个链接对方点开就进来，两个人也能玩。', html: '<p>视频通话里最尴尬的就是「聊完了，然后呢」。与其干瞪着摄像头，不如开一局<strong>有 AI 主持的游戏</strong>——不用下载、不用凑人，把房间链接发到聊天框，对方点一下就进来了。</p><h2>适合视频通话的几种</h2><p><strong>海龟汤：</strong>一人出题 AI 当裁判，大家靠是非题破案，边聊边玩最合适。<a href="/zh/games/lateral-thinking">详情</a>。</p><p><strong>剧本杀：</strong>AI 补满角色，两个人也能完整推理。<a href="/zh/games/murder-mystery">详情</a>。</p><p><strong>真心话大冒险：</strong>AI 出题，破冰神器。<a href="/zh/games/truth-or-dare">详情</a>。</p><p>海龟汤、真心话、午夜猫诅咒每周还能免费玩 2 小时。<a href="/zh">现在开一局</a>。</p>' },
    en: { title: 'Games to play over a video call (just share a link)', excerpt: 'On a video call with friends but out of things to do? These AI-hosted games start from a single link, work for two, and need no download.', html: '<p>The awkward part of any video call is the moment after the catching-up runs out. Instead of staring at the camera, start an <strong>AI-hosted game</strong> — no download, no scheduling a crowd, just paste the room link in the chat and your friend is in.</p><h2>Great over a call</h2><p><strong>Lateral thinking soup:</strong> one person sets the puzzle, the AI judges, everyone cracks it with yes/no questions while you chat. <a href="/en/games/lateral-thinking">Details</a>.</p><p><strong>Murder mystery:</strong> the AI fills the roles, so two people get a full whodunit. <a href="/en/games/murder-mystery">Details</a>.</p><p><strong>Truth or Dare:</strong> AI-generated prompts, a perfect ice-breaker. <a href="/en/games/truth-or-dare">Details</a>.</p><p>Soup, Truth or Dare and Midnight Cat Curse are free 2 hours every week. <a href="/en">Start one now</a>.</p>' },
  },
  {
    slug: 'online-games-for-long-distance-couples', date: '2026-10-05',
    zh: { title: '异地情侣可以一起玩的在线游戏', excerpt: '异地最难的是「一起做点什么」。这几种在线游戏专为两个人设计，隔着屏幕也能有共同的今晚。', html: '<p>异地恋最缺的不是聊天，而是<strong>一起做一件事</strong>的时间。看剧要同步、打游戏又太硬核，其实有更轻的选择：有 AI 主持、两个人就能开的在线游戏。</p><h2>适合两个人的</h2><p><strong>克苏鲁调查：</strong>一场有氛围、有紧张感的恐怖探案，很适合两个人慢慢推。<a href="/zh/games/cthulhu">详情</a>。</p><p><strong>海龟汤：</strong>十几分钟一局，一起破一个诡异的谜，睡前刚好。<a href="/zh/games/lateral-thinking">详情</a>。</p><p><strong>讲故事：</strong>AI 现编现讲一个只属于今晚的原创故事，还配真人嗓音朗读。<a href="/zh/games/storyteller">详情</a>。</p><p>把房间链接发给 TA，点开就一起了。<a href="/zh">今晚开一局</a>。</p>' },
    en: { title: 'Online games for long-distance couples', excerpt: 'The hardest part of long distance is doing something together. These online games are built for two, so you can still share a night across the screen.', html: '<p>Long distance is not short on messaging — it is short on <strong>doing one thing together</strong>. Syncing a show is fiddly and most games are too hardcore, but there is a lighter option: AI-hosted online games that work for just two people.</p><h2>Good for two</h2><p><strong>Cthulhu investigation:</strong> an atmospheric, tense horror case to work through slowly together. <a href="/en/games/cthulhu">Details</a>.</p><p><strong>Lateral thinking soup:</strong> a 15-minute riddle to crack before bed. <a href="/en/games/lateral-thinking">Details</a>.</p><p><strong>Storyteller:</strong> the AI writes and narrates an original story just for tonight, read aloud in a real voice. <a href="/en/games/storyteller">Details</a>.</p><p>Share the room link and you are playing together. <a href="/en">Start one tonight</a>.</p>' },
  },
  {
    slug: 'what-is-blood-on-the-clocktower-online', date: '2026-10-08',
    zh: { title: '血染钟楼是什么？在线怎么玩（类狼人杀社交推理）', excerpt: '血染钟楼是进阶版狼人杀：好人阵营对邪恶阵营，信息更丰富、翻盘更刺激。现在 AI 能当说书人，补满空位，随时开局。', html: '<p><strong>血染钟楼</strong>（Blood on the Clocktower）是近年最火的社交推理游戏之一，可以理解成<strong>进阶版狼人杀</strong>：好人阵营靠各自的角色能力找出藏在人群里的恶魔，而死去的玩家依然能发言投票，信息密度和翻盘空间都比传统狼人杀大得多。</p><h2>在线怎么玩</h2><p>传统血染钟楼需要一位熟练的「说书人」主持夜晚、发身份、裁定技能——这正是门槛所在。在线版里 <strong>AI 当说书人</strong>：发放隐藏身份、主持夜晚与白天、补满 AI 席位，所以人不够也能开。</p><p>想了解规则和试玩，<a href="/zh/games/bloodbound">看血染钟楼玩法</a>，或<a href="/zh">进入游戏</a>。</p>' },
    en: { title: 'What is Blood on the Clocktower, and how to play it online', excerpt: 'Blood on the Clocktower is social deduction leveled up from Werewolf: richer information, bigger comebacks. An AI can now run the Storyteller role and fill empty seats, so you can play anytime.', html: '<p><strong>Blood on the Clocktower</strong> is one of the most popular social-deduction games around — think of it as <strong>Werewolf leveled up</strong>: the good team uses each character\'s ability to find the demon hiding among them, and dead players still talk and vote, so the information and comeback potential dwarf classic Werewolf.</p><h2>Playing it online</h2><p>Traditional Clocktower needs a skilled <strong>Storyteller</strong> to run the night, hand out roles and adjudicate abilities — which is the barrier. Online, an <strong>AI plays the Storyteller</strong>: it deals hidden roles, runs night and day, and fills AI seats, so a short table still works.</p><p>For the rules and a quick try, <a href="/en/games/bloodbound">see how Bloodbound works</a>, or <a href="/en">enter the app</a>.</p>' },
  },
  {
    slug: 'ai-game-master-explained', date: '2026-10-11',
    zh: { title: 'AI 游戏主持（AI DM）是什么？能替代真人主持吗', excerpt: 'AI 游戏主持就是让人工智能当那个出题、扮演 NPC、把控节奏、知道真相的「主持人」。它不替真人发言，只负责把世界跑起来。', html: '<p>很多桌游最累的角色是<strong>主持人（DM / 守密人 / 说书人）</strong>：要准备剧本、扮演所有 NPC、裁定规则、守住真相。<strong>AI 游戏主持</strong>就是把这个角色交给人工智能。</p><h2>AI 主持做什么</h2><p>它现场生成剧情与案件、扮演会撒谎会甩锅的 NPC、按确定性规则裁定骰子和检定、并严格守住只有主持人知道的真相。它<strong>不替真人玩家发言</strong>——你和朋友才是桌上的玩家。</p><h2>能替代真人吗</h2><p>对「凑不齐人、没人愿意当 DM、想随时开一局」的场景，AI 主持几乎是刚需；而真人主持独有的临场默契，AI 也在不断逼近。<a href="/zh">挑一个玩法试试</a>。</p>' },
    en: { title: 'What is an AI game master (AI DM)? Can it replace a human host?', excerpt: 'An AI game master is an AI playing the host — generating the story, voicing NPCs, pacing the table and guarding the truth. It never speaks for the real players; it just runs the world.', html: '<p>In most tabletop games the exhausting seat is the <strong>host (DM, Keeper, Storyteller)</strong>: prep the script, voice every NPC, adjudicate rules, guard the secret. An <strong>AI game master</strong> hands that seat to an AI.</p><h2>What an AI host does</h2><p>It generates the plot and cases live, plays lying and scheming NPCs, resolves dice and checks by deterministic rules, and strictly guards the truth only the host should know. It <strong>never speaks for the real players</strong> — you and your friends are the table.</p><h2>Can it replace a human?</h2><p>For the common case — can\'t gather enough people, nobody wants to DM, you want to start on demand — an AI host is close to essential, while it keeps closing the gap on a human host\'s live chemistry. <a href="/en">Pick a mode and try it</a>.</p>' },
  },
  {
    slug: 'free-online-party-games-no-download', date: '2026-10-14',
    zh: { title: '免费在线派对游戏：免下载，开个链接就能玩', excerpt: '聚会、宿舍夜、视频群聊想玩点什么，又不想每个人都装软件？这些在线游戏开链接就玩，还有永久免费的几款。', html: '<p>组织一场游戏夜最烦的是「大家先去下载一下」。其实有一批<strong>免下载的在线游戏</strong>，主持人开一局、把链接丢群里，所有人点开就进——手机电脑都行。</p><h2>免费又好上手的</h2><p><strong>海龟汤</strong>、<strong>真心话大冒险</strong>、<strong>午夜猫诅咒</strong>每周都能<strong>免费玩 2 小时</strong>，新账号登录还送 2 次任意游戏。</p><p>玩法从烧脑推理到破冰互动都有，AI 当主持，不用有人提前读规则。<a href="/zh">开一局丢进群</a>，或先<a href="/zh/games/lateral-thinking">看海龟汤怎么玩</a>。</p>' },
    en: { title: 'Free online party games — no download, just a link', excerpt: 'Hosting a game night, dorm hang or group call and don\'t want everyone installing an app? These online games run from a link, and several are free forever.', html: '<p>The most annoying part of a game night is "everyone go download this first." A whole set of <strong>no-download online games</strong> skip that: the host opens a game, drops the link in the chat, and everyone taps in — phone or laptop.</p><h2>Free and easy to start</h2><p><strong>Lateral thinking soup</strong>, <strong>Truth or Dare</strong> and <strong>Midnight Cat Curse</strong> are <strong>free 2 hours every week</strong>, and new accounts get 2 free plays on any game.</p><p>They range from brain-burning deduction to ice-breaking fun, with an AI host so nobody has to read rules in advance. <a href="/en">Open one for the group</a>, or <a href="/en/games/lateral-thinking">see how soup works</a> first.</p>' },
  },
  {
    slug: 'cthulhu-rpg-online-for-beginners', date: '2026-10-17',
    zh: { title: '新手如何在线玩克苏鲁跑团（COC）', excerpt: '想玩克苏鲁跑团又怕规则复杂、找不到守密人？在线版有 AI 当守密人，带你建卡、检定、推进剧情，一个人也能跑。', html: '<p><strong>克苏鲁的呼唤（Call of Cthulhu, COC）</strong>是经典的恐怖调查跑团，魅力在于理智值、调查和那种步步逼近真相的紧张感。但新手常卡在两点：规则看不懂、找不到守密人。</p><h2>在线版怎么降低门槛</h2><p>在线克苏鲁里 <strong>AI 当守密人</strong>：引导你建调查员、自动做检定和理智判定、现场生成案件和插画、把控节奏。你不需要提前读规则书，1–6 人都能玩，<strong>一个人也能完整跑一场</strong>。</p><p><a href="/zh/games/cthulhu">看克苏鲁跑团详情</a>，或直接<a href="/zh">开一场调查</a>。</p>' },
    en: { title: 'How to play Call of Cthulhu online as a beginner', excerpt: 'Want to try Call of Cthulhu but worried about the rules or finding a Keeper? The online version has an AI Keeper that walks you through character creation, checks and the story — solo works too.', html: '<p><strong>Call of Cthulhu (CoC)</strong> is the classic horror investigation RPG; the appeal is sanity, investigation and that slow, tightening dread. Beginners usually stall on two things: the rules look dense, and there is no Keeper.</p><h2>How the online version lowers the bar</h2><p>Online, an <strong>AI plays the Keeper</strong>: it guides character creation, rolls checks and sanity automatically, generates the case and illustrations live, and paces the session. You do not need to read the rulebook first, 1–6 players work, and a <strong>solo run is fully playable</strong>.</p><p><a href="/en/games/cthulhu">See how the Cthulhu mode works</a>, or <a href="/en">start an investigation</a>.</p>' },
  },
];

export const post = (slug: string) => POSTS.find((p) => p.slug === slug);
