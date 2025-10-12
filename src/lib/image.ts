// Lightweight shimmer placeholder used with Next/Image blurDataURL
export function shimmer(width: number, height: number) {
  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <defs>
      <linearGradient id="g">
        <stop stop-color="#eeeeee" offset="20%" />
        <stop stop-color="#dddddd" offset="50%" />
        <stop stop-color="#eeeeee" offset="70%" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#eeeeee" />
    <rect id="r" width="100%" height="100%" fill="url(#g)" />
    <animate xlink:href="#r" attributeName="x" from="-100%" to="100%" dur="1.5s" repeatCount="indefinite"  />
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Raster placeholder URL for safe Next/Image optimization
export const placeholderUrl = 'https://placehold.co/800x600.jpg?text=Hotel+Image';
