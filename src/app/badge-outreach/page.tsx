// The badge-outreach queue moved into the /growth dashboard as its own board. This panel-gated URL
// is kept so any existing bookmarks / links resolve — it just forwards to the new board.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BadgeOutreachPage() {
  redirect("/growth/badges");
}
