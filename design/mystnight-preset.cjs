/**
 * MystNight Design System — Tailwind preset.
 * Mirrors the Figma Variables (Primitives → Semantic → Scale) 1:1.
 * Usage in tailwind.config.ts:  presets: [require('./design/mystnight-preset.cjs')]
 */
const primitives = {
  ink: '#0c0d10', fog: '#1a1c22', 'fog-2': '#232730', 'fog-3': '#2c313c',
  parchment: '#d8c7a8', 'parchment-dim': '#a99c82', 'parchment-faint': '#6f6757', white: '#f2ead9',
  blood: '#7d1d1d', 'blood-bright': '#a83232', eldritch: '#2f5d54', 'eldritch-bright': '#3f7d70',
  amber: '#d9a441', green: '#4ca36a', rust: '#b3503f', sky: '#5aa0c4',
  'mcc-ink': '#070708', 'mcc-line': '#ece9e2',
};
module.exports = {
  theme: {
    extend: {
      colors: {
        ...primitives,
        // semantic aliases (Dark mode)
        bg: { page: primitives.ink, surface: primitives.fog, raised: primitives['fog-2'], hover: primitives['fog-3'] },
        text: { primary: primitives.parchment, secondary: primitives['parchment-dim'], muted: primitives['parchment-faint'], inverse: primitives.white },
        accent: { DEFAULT: primitives.blood, hover: primitives['blood-bright'] },
        mystic: { DEFAULT: primitives.eldritch, hover: primitives['eldritch-bright'] },
        border: { DEFAULT: primitives.eldritch },
        state: { success: primitives.green, warning: primitives.amber, danger: primitives.rust, info: primitives.sky },
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },
      spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px' },
      fontFamily: { serif: ['Noto Serif SC', 'Georgia', 'serif'] },
    },
  },
};
