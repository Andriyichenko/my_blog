import type { APIRoute } from 'astro';
//export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // 从不同的 header 中尝试获取真实 IP
  const ip =
    request.headers.get('cf-connecting-ip') ||           // Cloudflare
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() || // 代理链的第一个
    request.headers.get('x-real-ip') ||                  // Nginx
    request.headers.get('x-client-ip') ||
    'unknown';

  return new Response(
    JSON.stringify({ ip }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};