// 童话草原 · 持久世界 落地页（MVP 第一步：世界介绍 + 物种图鉴；22 题测试与世界即将接入）
import Link from 'next/link';

type Animal = { e: string; zh: string; d: string };
const HERBIVORES: Animal[] = [
  { e: '🐇', zh: '兔', d: '飞毛腿，群居兔窟' },
  { e: '🐁', zh: '田鼠', d: '极小，善藏善钻' },
  { e: '🐿️', zh: '松鼠', d: '树上灵巧，囤坚果' },
  { e: '🦌', zh: '小鹿', d: '高大善奔，温柔' },
];
const OMNIVORES: Animal[] = [
  { e: '🦔', zh: '刺猬', d: '尖刺护甲，夜行' },
  { e: '🦡', zh: '獾', d: '壮实耐打，掘洞' },
  { e: '🐦', zh: '乌鸦', d: '会飞，极聪明' },
];
const CARNIVORES: Animal[] = [
  { e: '🦊', zh: '狐', d: '狡黠魅力的猎手' },
  { e: '🦦', zh: '鼬', d: '凶悍，能钻进巢穴' },
  { e: '🦉', zh: '猫头鹰', d: '无声夜袭' },
];

function Group({ title, color, list }: { title: string; color: string; list: Animal[] }) {
  return (
    <div>
      <div className={`text-xs tracking-widest uppercase mb-2 ${color}`}>{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {list.map((a) => (
          <div key={a.zh} className="rounded-lg border border-eldritch/25 bg-fog/40 p-3 flex flex-col items-center gap-1 text-center">
            <span className="text-3xl">{a.e}</span>
            <span className="text-parchment text-sm font-serif">{a.zh}</span>
            <span className="text-parchment/45 text-xs leading-snug">{a.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MeadowPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 gap-10">
      <div className="w-full max-w-3xl text-center flex flex-col items-center gap-4">
        <div className="text-5xl">🌾🦊🐇🦉</div>
        <h1 className="text-3xl sm:text-5xl font-serif text-parchment">童话草原</h1>
        <p className="text-parchment/70 max-w-xl leading-relaxed">
          这是一本旧童话书里的一片小草原。所有动物都会说话、有名字、讲着自己的故事——可童话不等于无害：狐狸真的会吃掉兔子，寒冬真的会饿死田鼠。
        </p>
        <p className="text-parchment/55 max-w-xl leading-relaxed text-sm">
          你将随机生为草原上的一种动物，肉食或草食，从一只幼崽开始。世界按真实时间的 10 倍流动、永不重置——离线时它也在变。在食物链里活下去、觅食、捕猎、结盟、繁衍，让血脉延续。死亡是永久的，但你的子嗣会继承这片草原的故事。
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        <Group title="草食 · 猎物" color="text-green" list={HERBIVORES} />
        <Group title="杂食" color="text-amber" list={OMNIVORES} />
        <Group title="肉食 · 猎手" color="text-rust" list={CARNIVORES} />
      </div>

      <div className="w-full max-w-3xl rounded-xl border border-eldritch/30 bg-fog/40 p-6 text-center flex flex-col items-center gap-3">
        <div className="font-serif text-parchment text-lg">开始你的一生</div>
        <p className="text-parchment/55 text-sm max-w-md">先做一份动物人格测试，决定你生为哪种动物、有怎样的天赋与性子。测试与草原世界正在搭建中，很快开放。</p>
        <button disabled className="px-6 py-3 rounded bg-blood/40 text-parchment/60 border border-blood/40 cursor-not-allowed">即将开放 · 正在搭建</button>
      </div>

      <Link href="/" className="text-parchment/40 hover:text-parchment text-sm underline">← 返回首页</Link>
    </main>
  );
}
