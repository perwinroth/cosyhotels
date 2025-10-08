import { NextRequest } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return new Response('Missing url', { status: 400 });
    const upstream = await fetch(url, {
      redirect: 'follow', cache: 'no-store', headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        'accept': 'image/avif,image/webp,*/*',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
    if (!upstream.ok || !upstream.body) return new Response('Not Found', { status: 404 });
    const headers = new Headers();
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    headers.set('content-type', ct);
    headers.set('cache-control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400');
    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response('Error', { status: 500 });
  }
}
