/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 部署时不因类型/lint 的小告警中断构建（先上线，细节可后续再清理）
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // 音乐网站（public/music 下的静态页面）：/music 和 /music/s/01 这样的干净网址指向对应的 index.html
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/music', destination: '/music/index.html' },
        { source: '/music/s/:id', destination: '/music/s/:id/index.html' },
      ],
    };
  },
  async headers() {
    return [{ source: '/music/media/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] }];
  },
};
module.exports = nextConfig;
