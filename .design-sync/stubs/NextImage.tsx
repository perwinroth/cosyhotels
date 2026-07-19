// PREVIEW STUB — next/image → plain img (design-sync bundle only)
import * as React from "react";
export default function Image({ src, alt, fill, width, height, sizes, priority, quality, loader, placeholder, blurDataURL, unoptimized, style, ...rest }: any) {
  const s = typeof src === "object" && src?.src ? src.src : src;
  const st = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: (style && style.objectFit) || "cover", ...style } : style;
  return <img src={s} alt={alt || ""} width={fill ? undefined : width} height={fill ? undefined : height} style={st} {...rest} />;
}
