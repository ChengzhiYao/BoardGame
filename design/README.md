# MystNight Design System

Figma: https://www.figma.com/design/eNuQzlYCFtHaGRx3aDDVjH/MystNight-Design-System

- `mystnight-preset.cjs` — Tailwind preset mirroring the Figma Variables (Primitives → Semantic → Scale). Wired in `tailwind.config.ts` via `presets`.
- `tokens.css` — the same tokens as CSS variables for runtime theming.
- `../components/ui/` — starter React components matching the Figma components (Button, Badge, Card, Chip, ScoreBar), styled only with semantic token classes (`bg-bg-surface`, `text-text-primary`, `border-border/30`, `bg-accent`, `state-success`…).
- `../components/ui/*.figma.tsx` + `../figma.config.json` — Figma Code Connect. To publish (shows code in Figma Dev Mode):
  ```bash
  npm i -D @figma/code-connect
  npx figma connect publish --token <FIGMA_TOKEN>
  ```
  (`*.figma.tsx` is excluded from the Next build via tsconfig.)
