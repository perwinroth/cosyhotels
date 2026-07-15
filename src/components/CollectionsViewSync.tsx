"use client";
// Cross-device sync: the visitor proved ownership of these collections by following the emailed
// magic link, so on mount we write them all into this device's multi-collection store (gc_collections,
// src/lib/collectionStore.ts) so the header "Collections" entry point and the owner controls on each
// list's own page work here too, without them needing to keep the emailed link around.
import { useEffect } from "react";
import { addCollection } from "@/lib/collectionStore";

export type SyncEntry = { slug: string; editToken: string; title: string | null };

export default function CollectionsViewSync({ entries }: { entries: SyncEntry[] }) {
  useEffect(() => {
    for (const entry of entries) addCollection(entry);
    // Only ever needs to run once per page load — entries are the server-rendered token payload,
    // not something that changes during the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
