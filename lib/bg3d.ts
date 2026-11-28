// 首页 3D 动态背景:背景 id → public/bg3d/ 里的场景页。不在这里的 id(含默认 night)用原来的克苏鲁荒径场景。
// 新做好一个 3D 场景:把 html 放进 public/bg3d/,在这里加一行,它就会出现在「我的 → 动态背景」里。
export const DEFAULT_BG_SRC = '/coc3d-demo.html?embed=1&full=1&auto=1';
export const BG3D: Record<string, string> = {
  pumpkin: '/bg3d/halloween.html',
  aurora: '/bg3d/aurora.html',
  graveyard: '/bg3d/graveyard.html',
  ufo: '/bg3d/ufo.html',
  rift: '/bg3d/rift.html',
  harbor: '/bg3d/harbor.html',
  eclipse: '/bg3d/eclipse.html',
  neon: '/bg3d/neon.html',
  meteor: '/bg3d/meteor.html',
  startrail: '/bg3d/startrail.html',
};
export const bgSrc = (id?: string | null) => (id && BG3D[id] ? `${BG3D[id]}?embed=1&v=1` : DEFAULT_BG_SRC);
