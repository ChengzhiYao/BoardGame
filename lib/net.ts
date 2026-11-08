// 取客户端真实 IP（Vercel/反代会放在这些头里）。取不到返回空串。
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  if (xff) return xff.split(',')[0].trim();
  return (req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || '').trim();
}
