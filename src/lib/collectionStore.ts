// Multi-collection localStorage store ("gc_collections"). Saved lists v1 tracked only ONE
// collection per device (legacy key "gc_trip" = {slug, editToken}). A visitor can now save several
// collections on the same device, so this stores an ARRAY, most-recent first, de-duped by slug,
// capped at MAX_COLLECTIONS. Pure client module (no "use client" needed, nothing here is a React
// component). Backward compatible: readCollections() migrates a lone legacy gc_trip into the array
// the first time it's read, and every write also refreshes gc_trip = latest, so any code that still
// only reads the legacy key keeps working.
const STORE_KEY = "gc_collections";
const LEGACY_KEY = "gc_trip";
const MAX_COLLECTIONS = 50;

export type StoredCollection = { slug: string; editToken: string; title: string | null };
type LegacyTrip = { slug: string; editToken: string };

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readLegacyTrip(): LegacyTrip | null {
  const parsed = safeParse<LegacyTrip>(window.localStorage.getItem(LEGACY_KEY));
  if (parsed && typeof parsed.slug === "string" && typeof parsed.editToken === "string") return parsed;
  return null;
}

function isValidEntry(x: unknown): x is StoredCollection {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return typeof c.slug === "string" && typeof c.editToken === "string" && (c.title === null || c.title === undefined || typeof c.title === "string");
}

function writeLegacy(entry: StoredCollection) {
  try {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ slug: entry.slug, editToken: entry.editToken }));
  } catch {
    /* localStorage unavailable (private mode) */
  }
}

function writeAll(list: StoredCollection[]) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_COLLECTIONS)));
  } catch {
    /* localStorage unavailable (private mode) */
  }
  if (list[0]) writeLegacy(list[0]);
}

/** Read all collections saved on this device, most-recent first. Migrates a legacy gc_trip on first
 *  read if gc_collections is still empty. Never throws. */
export function readCollections(): StoredCollection[] {
  try {
    const parsed = safeParse<unknown[]>(window.localStorage.getItem(STORE_KEY));
    const list = Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
    if (list.length > 0) return list;
    const legacy = readLegacyTrip();
    if (legacy) {
      const migrated: StoredCollection[] = [{ slug: legacy.slug, editToken: legacy.editToken, title: null }];
      writeAll(migrated);
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

/** Add (or move-to-front + refresh) a collection. Most-recent first, de-duped by slug. */
export function addCollection(entry: StoredCollection): void {
  const current = readCollections();
  const rest = current.filter((c) => c.slug !== entry.slug);
  writeAll([entry, ...rest]);
}

/** True if this device already knows about the given slug. */
export function hasCollection(slug: string): boolean {
  return readCollections().some((c) => c.slug === slug);
}

/** The edit token for a given slug, if this device has one, else null. */
export function getToken(slug: string): string | null {
  return readCollections().find((c) => c.slug === slug)?.editToken ?? null;
}

/** Clear every collection this device knows about (both the array and the legacy single-collection
 *  key). Used after a right-to-be-forgotten erasure, so a deleted visitor's device does not keep
 *  offering links to collections that no longer exist server-side. Never throws. */
export function clearCollections(): void {
  try {
    window.localStorage.removeItem(STORE_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* localStorage unavailable (private mode) */
  }
}
