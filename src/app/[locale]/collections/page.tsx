// Retired for now (rebuild later). Redirect to the homepage.
import { redirect } from "next/navigation";

export default function CollectionsPage({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}`);
}
