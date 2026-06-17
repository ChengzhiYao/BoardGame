import type { Config } from 'tailwindcss';

// 克苏鲁暗黑主题基础配色
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0c0d10',        // 背景
        parchment: '#d8c7a8',  // 羊皮纸文字
        blood: '#7d1d1d',      // 强调红
        eldritch: '#2f5d54',   // 神秘绿
        fog: '#1a1c22',        // 面板
      },
      fontFamily: {
        serif: ['Georgia', 'Noto Serif SC', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
