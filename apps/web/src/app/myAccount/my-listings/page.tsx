"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Navbar } from "@/components/ui/navbar";
import { RegisterVehicle } from "@/components/ui/register-vehicle";
import { QRDisplay } from "@/components/ui/qr-display";
import { ListingNotifications } from "@/components/ui/listing-notifications";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useToast } from "@/hooks/useToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  CheckCircle,
  Clock,
  Eye,
  Plus,
  QrCode,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { isTrustedImageUrl } from "@/lib/trusted-images";
import { redirect, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function MyListingsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">Loading listings...</p>}>
      <MyListingsContent />
    </Suspense>
  );
}

function MyListingsContent() {
  const { toast, toasts, dismiss } = useToast();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [selectedQR, setSelectedQR] = useState<string | null>(null);

  // Always call hooks to maintain hook order
  const currentUser = useQuery(
    api.users.current,
    isAuthenticated && user?.id ? {} : "skip"
  );
  const userVehicles = useQuery(
    api.vehicles.getVehiclesByUser,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );
  const userRegistrations = useQuery(
    api.registrations.getRegistrationsByUser,
    currentUser?._id ? {} : "skip"
  );
  const analytics = useQuery(api.vehicles.getSellerAnalytics, currentUser?._id ? {} : "skip");
  const changeStatus = useMutation(api.vehicles.changeVehicleStatus);
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const deleteVehicle = useMutation(api.vehicles.deleteVehicle);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  const createdVehicleId = searchParams.get("created");

  const handleDeleteVehicle = async (vehicleId: Id<"vehicles">) => {
    if (!confirm("Delete this listing permanently? Listings with conversations or event registrations must be withdrawn instead to preserve their history.")) return;
    setActionError("");
    setUpdatingId(vehicleId);
    try {
      await deleteVehicle({ id: vehicleId });
      toast({ title: "Listing deleted" });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete this listing.");
    } finally { setUpdatingId(null); }
  };

  const handleStatus = async (id: Id<"vehicles">, status: "draft" | "pending" | "active" | "reserved" | "sold" | "withdrawn" | "archived") => {
    setActionError("");
    setUpdatingId(id);
    try {
      await changeStatus({ id, status });
      const confirmations = {
        draft: "Listing returned to draft",
        pending: "Listing submitted for review",
        active: "Reservation released",
        reserved: "Listing marked reserved",
        sold: "Listing marked sold",
        withdrawn: "Listing withdrawn",
        archived: "Listing archived",
      };
      toast({ title: confirmations[status], description: status === "withdrawn" ? "Your conversations and event registrations are preserved." : undefined });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update listing.");
    } finally { setUpdatingId(null); }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="market-page min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Listings</h1>
              <p className="text-gray-600">
                Manage your vehicle listings and registrations
              </p>
            </div>
            <Button asChild className="text-white">
              <Link href="/myAccount/new-listing">
                <Plus className="h-5 w-5 mr-2" />
                New Listing
              </Link>
            </Button>
          </div>
        </div>

        {/* Success Message */}
        {createdVehicleId && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-green-800">
                Your listing has been saved successfully. Submitted listings will be reviewed by our team.
              </p>
            </div>
          </div>
        )}

        {actionError && <p className="mb-4 text-red-700" role="alert">{actionError}</p>}
        <ListingNotifications enabled={Boolean(currentUser?._id)} />
        {/* Listings Grid */}
        {userVehicles === undefined ? <p role="status" className="py-12 text-center text-gray-600">Loading your listings...</p> : userVehicles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {userVehicles.map((vehicle) => {
              const registration = userRegistrations?.find(
                (reg) => reg.vehicleId === vehicle._id && reg.paymentStatus === "completed"
              );

              const metrics = analytics?.find((entry) => entry.vehicleId === vehicle._id);
              const latestRejection = [...(vehicle.moderationHistory ?? [])].reverse().find((entry) => entry.toStatus === "rejected" && entry.reason);
              const moderationReason = vehicle.moderationReason || (vehicle.status === "rejected" ? latestRejection?.reason : undefined);

              return (
                <Card
                  key={vehicle._id}
                  id={`listing-${vehicle._id}`}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative">
                    {isTrustedImageUrl(vehicle.thumbnailPhotos?.[0] ?? vehicle.photos[0] ?? "") ? (
                      <Image
                        width={800}
                        height={600}
                        src={vehicle.thumbnailPhotos?.[0] ?? vehicle.photos[0]}
                        alt={vehicle.title}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500">No Image</span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full flex items-center space-x-1 ${getStatusColor(vehicle.status)}`}
                      >
                        {getStatusIcon(vehicle.status)}
                        <span className="capitalize">{vehicle.status}</span>
                      </span>
                    </div>

                    {/* Registration Status */}
                    {registration && (
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              registration.checkedIn
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {registration.event?.cancelledAt
                              ? "Event Cancelled"
                              : registration.checkedIn
                              ? "Checked In"
                              : "Not Checked In"}
                          </span>
                          {registration.qrCodeData && !registration.event?.cancelledAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setSelectedQR(registration.qrCodeData!)
                              }
                              className="bg-white/80 hover:bg-white"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg line-clamp-1 mb-2">
                      {vehicle.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                      <span>{vehicle.mileage.toLocaleString()} {vehicle.mileageUnit ?? "mi"}</span>
                      <span className="font-semibold text-primary text-lg">
                        ${vehicle.price.toLocaleString()}
                      </span>
                    </div>

                    {/* Registration Info */}
                    {registration && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-900">
                            {registration.event?.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {registration.event?.date
                              ? new Date(
                                  registration.event.date
                                ).toLocaleDateString()
                              : "TBD"}
                          </p>
                        </div>
                      </div>
                    )}

                    {metrics && (
                      <dl className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                        {[["Views", metrics.views], ["Saved", metrics.favorites], ["Conversations", metrics.conversations], ["Buyer inquiries", metrics.inquiries]].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-gray-600">{label}</dt>
                            <dd className="font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {moderationReason && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-semibold">{vehicle.status === "rejected" ? "Changes needed before resubmission" : "Moderation note"}</p><p className="mt-1">{moderationReason}</p></div>}
                    <details className="text-sm mb-3"><summary className="cursor-pointer">Listing history</summary><ol className="space-y-2 mt-2">{vehicle.moderationHistory?.map((entry, index) => <li key={index}>{new Date(entry.createdAt).toLocaleString()}: {entry.fromStatus ?? "new"} → {entry.toStatus}. {entry.reason}</li>)}</ol></details>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {!["sold", "archived", "withdrawn"].includes(vehicle.status) && <Button asChild size="sm" variant="outline"><Link href={`/myAccount/new-listing?edit=${vehicle._id}`}>{vehicle.status === "rejected" ? "Edit & resubmit" : vehicle.status === "draft" ? "Continue draft" : "Edit listing"}</Link></Button>}
                      {vehicle.status === "pending" && <Button size="sm" variant="outline" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "draft")}>Return to draft</Button>}
                      {["archived", "withdrawn"].includes(vehicle.status) && <Button size="sm" variant="outline" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "draft")}>Reopen as draft</Button>}
                      {["draft", "rejected"].includes(vehicle.status) && <Button asChild size="sm"><Link href={`/myAccount/new-listing?edit=${vehicle._id}`}>Preview & submit</Link></Button>}
                      {["active", "approved"].includes(vehicle.status) && <Button size="sm" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "reserved")}>Mark reserved</Button>}
                      {vehicle.status === "reserved" && <Button size="sm" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "active")}>Release reservation</Button>}
                      {["active", "approved", "reserved"].includes(vehicle.status) && <Button size="sm" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "sold")}>Mark sold</Button>}
                      {!["withdrawn", "archived", "sold"].includes(vehicle.status) && <Button size="sm" variant="outline" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "withdrawn")}>Withdraw</Button>}
                      {!["archived"].includes(vehicle.status) && <Button size="sm" variant="outline" disabled={updatingId !== null} onClick={() => handleStatus(vehicle._id, "archived")}>Archive</Button>}
                    </div>
                    {["active", "approved", "pending", "reserved"].includes(vehicle.status) && <p className="mb-3 text-xs text-gray-600">Editing specifications requires a new review before the listing can go live.</p>}
                    <p className="mb-3 text-xs text-gray-600">Withdrawing keeps conversations and event registrations available.</p>
                    {["active", "approved"].includes(vehicle.status) && <RegisterVehicle vehicleId={vehicle._id} />}
                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={`/vehicles/${vehicle._id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      {["draft", "rejected"].includes(vehicle.status) && !registration && (!metrics || metrics.conversations === 0) && <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingId !== null}
                        aria-label={`Delete ${vehicle.title}`}
                        onClick={() => handleDeleteVehicle(vehicle._id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="w-full">
            <Card>
              <CardContent className="text-center py-16">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="h-16 w-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0M15 17a2 2 0 104 0"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Listings Yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first vehicle listing to get started selling at
                  our events.
                </p>
                <Button asChild className="text-white">
                  <Link href="/myAccount/new-listing">
                    Create Your First Listing
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Event QR Code</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedQR(null)}
              >
                ×
              </Button>
            </div>
            <QRDisplay
              qrCodeData={selectedQR}
              title="Check-in QR Code"
              description="Show this QR code at the event for check-in"
            />
          </div>
        </div>
      )}

      <ToastProvider>
        {toasts.map((notification) => <Toast key={notification.id} onOpenChange={(open) => { if (!open) dismiss(notification.id); }}><div><ToastTitle>{notification.title}</ToastTitle>{notification.description && <ToastDescription>{notification.description}</ToastDescription>}</div><ToastClose onClick={() => dismiss(notification.id)} /></Toast>)}
        <ToastViewport />
      </ToastProvider>
      <Footer />
    </div>
  );
}
