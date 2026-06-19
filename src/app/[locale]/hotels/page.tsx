// Retired: the live-OSM listing is gone. Search now routes to canonical city guide pages
// (Supabase-served). Redirect any remaining /[locale]/hotels traffic to the homepage.
import { redirect } from "next/navigation";

export default function HotelsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}`);
}
