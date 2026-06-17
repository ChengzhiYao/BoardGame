// 随机调查员生成（本地词表，零 token）。玩家点一下填好，仍可自行编辑。中英两套。
import { itemsFor } from './items';

const SURNAMES = ['林', '沈', '陈', '苏', '顾', '周', '江', '宋', '程', '徐', '韩', '叶', '白', '方', '夏', '钟', '秦', '许', '柳', '温'];
const MALE_GIVEN = ['执言', '观山', '怀瑾', '一苇', '河图', '与之', '明烛', '拾遗', '砚秋', '寒山', '行简', '慎之'];
const FEMALE_GIVEN = ['青禾', '听澜', '若虚', '南星', '问荆', '砚清', '归尘', '寒鸦', '疏影', '晚晴', '昭', '见微'];
const OCCUPATIONS = ['私家侦探', '报社记者', '外科医生', '大学讲师', '古董商人', '刑警探长', '小说作家', '神父', '护士', '执业律师', '战地摄影师', '考古学者', '钟表匠', '退伍军人', '图书管理员', '灵媒', '远洋船员', '中学教师', '验尸官', '古籍修复师'];
const PERSONALITIES = ['沉默寡言，习惯把心事埋在心里', '神经质而敏锐，总能察觉别人忽略的细节', '表面温和，内里固执', '愤世嫉俗，却见不得弱者受苦', '理性到近乎冷漠', '乐观得有些天真，灾难面前才显出韧性', '谨慎多疑，从不轻信他人', '冲动易怒，行动先于思考', '彬彬有礼，藏着难以启齿的过去', '疲惫而执拗，靠一口气撑着'];
const BACKGROUNDS = [
  '幼年目睹过一场无法解释的火灾，从此对反常之事既恐惧又着迷。',
  '曾在战场上当过医护，见惯死亡，却始终忘不掉某一双眼睛。',
  '家道中落，靠为人查案糊口，最近接到一封没有署名的信。',
  '在大学里研究一段被官方抹去的历史，因此惹上麻烦。',
  '兄弟姐妹离奇失踪多年，循着唯一的线索来到此地。',
  '继承了一位远房亲戚的遗物，里面有些东西不该存在。',
  '因为一篇没人敢发的报道丢了工作，仍在追查真相。',
  '做过一个反复出现的梦，醒来后发现梦里的地点真实存在。',
];
const GOALS = ['查清亲人失踪的真相', '揭露一桩被掩盖的旧案', '找回失落的某样东西', '证明自己当年没有看错', '替一个死去的人讨个说法', '弄明白那些噩梦意味着什么', '保护还活着的人不再受害'];
const FEARS = ['黑暗中无法确认的脚步声', '深水与溺亡', '被活埋或密闭空间', '镜子里多出来的影子', '失去理智、认不出自己', '火，以及烧焦的气味', '听见有人念自己的名字却看不见人', '血'];
const APPEARANCE_MALE = [
  '短发利落，下颌一圈胡茬，眼神锐利', '梳着整齐的背头，戴金丝眼镜，面容清癯',
  '寸头，左眉一道旧疤，体格魁梧', '微卷的乱发，眼下有浓重黑眼圈，神情疲惫',
  '鬓角微白，蓄着小胡子，气度沉稳', '高瘦，颧骨突出，目光阴郁',
];
const APPEARANCE_FEMALE = [
  '齐肩黑发挽到耳后，颧骨分明，神情冷静', '长发披散，面色苍白，嘴角有一颗小痣',
  '利落短发，戴一顶宽檐帽，目光警惕', '发髻一丝不乱，戴珍珠耳钉，气质沉静',
  '微卷的栗色长发，眉眼温和却藏着倦意', '削瘦，戴黑框眼镜，神色专注',
];

const SURNAMES_EN = ['Carter', 'Vance', 'Holloway', 'Sable', 'Grayson', 'Marsh', 'Whitlock', 'Crane', 'Ashford', 'Quincy', 'Hargrove', 'Lindqvist', 'Bishop', 'Calloway', 'Reyes', 'Sterling', 'Faulkner', 'Pruitt', 'Dent', 'Wren'];
const MALE_GIVEN_EN = ['Elias', 'Theodore', 'Augustus', 'Silas', 'Desmond', 'Victor', 'Ambrose', 'Julian', 'Cormac', 'Roland', 'Edwin', 'Lucius'];
const FEMALE_GIVEN_EN = ['Adelaide', 'Marlowe', 'Iris', 'Nora', 'Cordelia', 'Eleanor', 'Vivian', 'Rowan', 'Beatrice', 'Lillian', 'Sabine', 'Mara'];
const OCCUPATIONS_EN = ['private detective', 'newspaper reporter', 'surgeon', 'university lecturer', 'antiques dealer', 'police inspector', 'novelist', 'priest', 'nurse', 'attorney', 'war photographer', 'archaeologist', 'watchmaker', 'army veteran', 'librarian', 'medium', 'merchant sailor', 'schoolteacher', 'coroner', 'book restorer'];
const PERSONALITIES_EN = [
  'tight-lipped, used to burying every worry inside',
  'nervous but sharp, always catching what others miss',
  'gentle on the surface, stubborn underneath',
  'cynical, yet can’t stand to see the weak suffer',
  'rational to the point of coldness',
  'almost naively optimistic, only showing grit in disaster',
  'cautious and suspicious, trusting no one easily',
  'hot-tempered and impulsive, acting before thinking',
  'impeccably polite, hiding an unspeakable past',
  'weary but dogged, running on sheer will',
];
const BACKGROUNDS_EN = [
  'Witnessed an unexplained fire as a child — both terrified by and drawn to the abnormal ever since.',
  'Served as a battlefield medic; numb to death, yet can’t forget one particular pair of eyes.',
  'Fallen on hard times, scraping by solving cases, and just received an unsigned letter.',
  'Researched a stretch of officially erased history at the university — and made enemies for it.',
  'A sibling vanished years ago; followed the one remaining clue all the way here.',
  'Inherited a distant relative’s effects, among which is something that should not exist.',
  'Lost a job over a story no one dared print, still chasing the truth.',
  'Had a recurring dream, then woke to find the place in it was real.',
];
const GOALS_EN = ['uncover the truth of a missing loved one', 'expose a buried old case', 'recover something long lost', 'prove they weren’t wrong back then', 'win justice for someone who died', 'understand what the nightmares mean', 'keep the living from being harmed again'];
const FEARS_EN = ['unplaceable footsteps in the dark', 'deep water and drowning', 'being buried alive or tight spaces', 'an extra shadow in the mirror', 'losing their mind and not knowing themselves', 'fire, and the smell of burning', 'hearing their name called with no one in sight', 'blood'];
const APPEARANCE_MALE_EN = [
  'cropped hair, a day’s stubble, sharp eyes', 'neatly combed-back hair, gold-rimmed glasses, gaunt face',
  'buzz cut, an old scar through the left brow, broad-built', 'tousled curls, heavy shadows under tired eyes',
  'greying temples, a trim moustache, composed air', 'tall and lean, prominent cheekbones, a grim gaze',
];
const APPEARANCE_FEMALE_EN = [
  'shoulder-length black hair tucked behind the ears, defined cheekbones, calm', 'loose long hair, pale face, a small mole at the lip',
  'sharp short hair, a wide-brimmed hat, wary eyes', 'a flawless bun, pearl earrings, a quiet poise',
  'wavy chestnut hair, soft eyes carrying fatigue', 'slight build, black-framed glasses, intent expression',
];

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function pickSome<T>(a: T[], n: number): T[] {
  const pool = [...a];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

export interface RandomInvestigator {
  name: string; gender: 'male' | 'female'; age: string; occupation: string;
  personality: string; background: string; personal_goal: string; fear: string; appearance: string;
  inventory: string[];
}

export function randomInvestigator(lang?: string): RandomInvestigator {
  const en = lang === 'en';
  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
  const items = itemsFor(lang);
  const noGun = (i: string) => en ? !/Revolver|Shotgun|ammo/i.test(i) : !/手枪|猎枪|弹药/.test(i);
  if (en) {
    const given = gender === 'male' ? pick(MALE_GIVEN_EN) : pick(FEMALE_GIVEN_EN);
    return {
      name: `${given} ${pick(SURNAMES_EN)}`,
      gender,
      age: String(22 + Math.floor(Math.random() * 34)),
      occupation: pick(OCCUPATIONS_EN),
      personality: pick(PERSONALITIES_EN),
      background: pick(BACKGROUNDS_EN),
      personal_goal: pick(GOALS_EN),
      fear: pick(FEARS_EN),
      appearance: gender === 'male' ? pick(APPEARANCE_MALE_EN) : pick(APPEARANCE_FEMALE_EN),
      inventory: pickSome(items.filter(noGun), 4),
    };
  }
  const given = gender === 'male' ? pick(MALE_GIVEN) : pick(FEMALE_GIVEN);
  return {
    name: pick(SURNAMES) + given,
    gender,
    age: String(22 + Math.floor(Math.random() * 34)),
    occupation: pick(OCCUPATIONS),
    personality: pick(PERSONALITIES),
    background: pick(BACKGROUNDS),
    personal_goal: pick(GOALS),
    fear: pick(FEARS),
    appearance: gender === 'male' ? pick(APPEARANCE_MALE) : pick(APPEARANCE_FEMALE),
    inventory: pickSome(items.filter(noGun), 4),
  };
}
