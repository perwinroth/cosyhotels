import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const src = url.searchParams.get('url');
  if (!src) return NextResponse.json({ error: 'missing url' }, { status: 400 });
  try {
    const u = new URL(src);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return NextResponse.json({ error: 'unsupported protocol' }, { status: 400 });
    }
    const res = await fetch(u.toString(), { redirect: 'follow' });
    if (!res.ok || !res.body) return new NextResponse('Not Found', { status: 404 });
    const headers = new Headers();
    headers.set('content-type', res.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400');
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }
}

