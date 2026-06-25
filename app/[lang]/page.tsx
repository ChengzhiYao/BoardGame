import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomeApp from '@/components/HomeApp';

export const dynamicParams = false;
export function generateStaticParams() { return [{ lang: 'zh' }, { lang: 'en' }]; }

export function generateMetadata({ params }: { params: { lang: string } }): Metadata {
  const en = params.lang === 'en';
  const title = en ? 'MystNight · AI-hosted tabletop nights for two or more' : '谜夜 MystNight · AI 主持的在线剧本杀 / 克苏鲁 / 海龟汤';
  const description = en
    ? 'One AI engine runs eight tabletop games — murder mystery, Cthulhu, D&D, lateral-thinking soup and more. Two players or a full table, every game generated live.'
    : '叫上朋友，两个人就能开局。AI 当主持人，现场现编剧本杀、克苏鲁跑团、海龟汤、D&D 等八种玩法，每局都不一样。';
  const lang = en ? 'en' : 'zh';
  return { title, description, alternates: { canonical: `/${lang}`, languages: { 'zh-CN': '/zh', en: '/en' } }, openGraph: { title, description, url: `/${lang}`, type: 'website', locale: en ? 'en_US' : 'zh_CN' } };
}

export default function LangHome({ params }: { params: { lang: string } }) {
  if (params.lang !== 'zh' && params.lang !== 'en') notFound();
  return <HomeApp forcedLang={params.lang === 'en' ? 'en' : 'zh'} />;
}
