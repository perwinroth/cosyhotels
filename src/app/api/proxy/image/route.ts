import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

// Simple image proxy to serve remote images through our domain.
// This avoids Next/Image remotePatterns issues and enables consistent caching.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  if (!target) return new NextResponse('Bad Request', { status: 400 });

  try {
    const u = new URL(target);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return new NextResponse('Unsupported protocol', { status: 400 });
    }

    // Fetch the image with a conservative UA; follow redirects.
    const res = await fetch(u.toString(), {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; cosyhotels-image-proxy/1.0)'
      },
      // Let Next cache at the edge for a day
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok || !res.body) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const headers = new Headers();
    const ct = res.headers.get('content-type') || 'image/jpeg';
    headers.set('content-type', ct);
    // Cache in browsers and CDN; allow stale while revalidate
    headers.set('cache-control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400');
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}

