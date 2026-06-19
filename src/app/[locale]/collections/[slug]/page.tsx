// Retired for now (rebuild later). Redirect to the homepage.
import { redirect } from "next/navigation";

type Props = { params: { slug: string; locale: string } };

export default function CollectionPage({ params }: Props) {
  redirect(`/${params.locale}`);
}
