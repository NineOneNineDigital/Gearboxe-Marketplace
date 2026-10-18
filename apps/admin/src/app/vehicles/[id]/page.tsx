import { redirectToPublicSite } from "../../../public-site";

export default async function PublicVehicle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirectToPublicSite(`/vehicles/${encodeURIComponent(id)}`);
}
