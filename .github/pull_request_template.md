## Checklist

- [ ] Front page renders 9 tiles (cosy ≥ 7) from `featured_top`
- [ ] Key city guides render 9 same‑city cosy (≥ 7) hotels (`city_top`)
- [ ] No SSR Google Places added to front page/guides

Notes:
- CI will fail the PR if `featured_top < 9` or any configured guide city has `< 9` cosy≥7 entries. Set `GUIDE_CITIES` repo variable to limit which cities are checked.

