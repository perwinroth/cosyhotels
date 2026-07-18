// PREVIEW STUB — next/link → plain anchor (design-sync bundle only)
import * as React from "react";
export default function Link({ href, prefetch, scroll, replace, shallow, locale, legacyBehavior, children, ...rest }: any) {
  return <a href={typeof href === "string" ? href : "#"} {...rest}>{children}</a>;
}
