import { redirectToPublicSite } from "../../../public-site";

export default async function PublicEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirectToPublicSite(`/events/${encodeURIComponent(id)}`);
}
