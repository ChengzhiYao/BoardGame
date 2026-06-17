// Stripe 服务端客户端。仅在服务端路由里使用。
import Stripe from 'stripe';
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('未配置 STRIPE_SECRET_KEY');
  return new Stripe(key);
}
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
