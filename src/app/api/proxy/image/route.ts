import { NextRequest } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return new Response('Missing url', { status: 400 });
    const upstream = await fetch(url, { redirect: 'follow', cache: 'no-store' });
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

