"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/ui/footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/ui/navbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAction, useMutation, useQuery } from "convex/react";
import { VehiclePhotoCarousel } from "@/components/ui/vehicle-photo-carousel";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { VehicleMediaEditor, type ListingMedia } from "@/components/ui/vehicle-media-editor";
import type { Id } from "@/convex/_generated/dataModel";
import { validateVehicle } from "@/convex/lib/vehicleValidation";
import { transitionListingEditorSession, type ListingEditorSession } from "@/lib/listing-editor-session";
import Link from "next/link";

const makes = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const currentYear = new Date().getFullYear();

export default function NewListingPage() {
  return <Suspense fallback={<p className="p-8">Loading listing...</p>}><ListingEditorBoundary /></Suspense>;
}

function ListingEditorBoundary() {
  const editId = useSearchParams().get("edit");
  const [session, setSession] = useState<ListingEditorSession>(() => ({ routeId: editId, generation: 0, createdId: null }));
  const next = transitionListingEditorSession(session, editId);
  const currentGeneration = useRef(next.generation);
  currentGeneration.current = next.generation;
  if (next !== session) setSession(next);
  return <ListingForm key={next.generation} editId={editId}
    isCurrentSession={() => currentGeneration.current === next.generation}
    onDraftCreated={id => setSession(previous => previous.generation === next.generation ? { ...previous, createdId: id } : previous)} />;
}

function ListingForm({ editId, isCurrentSession, onDraftCreated }: {
  editId: string | null;
  isCurrentSession: () => boolean;
  onDraftCreated: (id: string) => void;
}) {
  const existing = useQuery(api.vehicles.getVehicleById, editId ? { id: editId as Id<"vehicles"> } : "skip");
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const saveDraft = useMutation(api.vehicles.saveDraft);
  const submitVehicle = useMutation(api.vehicles.submitVehicle);
  const router = useRouter();
  const { isLoading, isAuthenticated, user: currentUser } = useCurrentUser();


  const decodeVin = useAction(api.vin.decodeVin);
  const [isDecoding, setIsDecoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [vinMessage, setVinMessage] = useState("Not verified");

  const [media, setMedia] = useState<ListingMedia[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const hydratedId = useRef<string | null>(null);
  const listingId = useRef<Id<"vehicles"> | undefined>(editId ? editId as Id<"vehicles"> : undefined);
  const revision = useRef<number | undefined>(undefined);
  const savedSnapshot = useRef("");
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const submissionLock = useRef(false);
  const saveBlocked = useRef(false);
  const requestId = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  const sessionLive = useCallback(() => mounted.current && isCurrentSession(), [isCurrentSession]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [saveStatus, setSaveStatus] = useState("Draft not saved yet");

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    make: "",
    model: "",
    year: "",
    mileage: "",
    price: "",
    vin: "",
    description: "",
    contactInfo: "",
    trim: "", bodyStyle: "", engine: "", transmission: "", drivetrain: "", fuelType: "",
    exteriorColor: "", interiorColor: "", mileageUnit: "mi" as "mi" | "km", odometerStatus: "actual" as "actual" | "exempt" | "not_actual",
    titleStatus: "unknown" as "clean" | "rebuilt" | "salvage" | "flood" | "lemon" | "other" | "unknown", sellerState: "", condition: "good" as "excellent" | "good" | "fair" | "poor", mechanicalIssues: "",
    accidentDisclosure: "unknown", damageDisclosure: "unknown", numberOfOwners: "",
    serviceRecords: "unknown" as "available" | "partial" | "unavailable" | "unknown", modifications: "", sellerType: "private" as "private" | "dealer", location: "", locationState: "", latitude: "", longitude: "",
    features: "", negotiable: false,
    photos: [] as string[],
  });

  const owned = Boolean(existing && currentUser && existing.userId === currentUser._id);
  const terminal = existing && ["sold", "withdrawn", "archived"].includes(existing.status);
  const editable = Boolean(!editId || (!existing && hydratedId.current === editId) || (owned && !terminal));
  useEffect(() => {
    if (!existing || !owned || terminal || hydratedId.current === existing._id) return;
    hydratedId.current = existing._id;
    setMedia(existing.media ?? []);
    const loaded = {
      ...formData,
      title: existing.title, make: existing.make, model: existing.model,
      year: existing.year ? String(existing.year) : "", mileage: String(existing.mileage), price: String(existing.price),
      vin: existing.vin ?? "", description: existing.description, contactInfo: existing.contactInfo,
      photos: existing.legacyPhotos ?? existing.photos, trim: existing.trim ?? "", bodyStyle: existing.bodyStyle ?? "",
      engine: existing.engine ?? "", transmission: existing.transmission ?? "", drivetrain: existing.drivetrain ?? "",
      fuelType: existing.fuelType ?? "", exteriorColor: existing.exteriorColor ?? "", interiorColor: existing.interiorColor ?? "",
      mileageUnit: existing.mileageUnit ?? "mi", odometerStatus: existing.odometerStatus ?? "actual",
      titleStatus: existing.titleStatus ?? "unknown", sellerState: existing.sellerState ?? "",
      condition: existing.condition ?? "good", mechanicalIssues: existing.mechanicalIssues ?? "",
      accidentDisclosure: existing.accidentDisclosure ?? "unknown", damageDisclosure: existing.damageDisclosure ?? "unknown",
      numberOfOwners: existing.numberOfOwners ? String(existing.numberOfOwners) : "", serviceRecords: existing.serviceRecords ?? "unknown",
      modifications: existing.modifications ?? "", sellerType: existing.sellerType ?? "private",
      location: existing.location?.city ?? "", locationState: existing.location?.state ?? "",
      latitude: existing.location?.latitude?.toString() ?? "", longitude: existing.location?.longitude?.toString() ?? "",
      features: existing.features?.join("\n") ?? "", negotiable: existing.negotiable ?? false,
    };
    setFormData(loaded);
    listingId.current = existing._id;
    revision.current = existing.updatedAt ?? existing.createdAt;
    savedSnapshot.current = JSON.stringify({ formData: loaded, media: existing.media ?? [] });
    setSaveStatus("All changes saved");
    setVinMessage(existing.vinVerificationStatus === "decoded" ? "VIN decoded" : "Not verified");
    // Hydrate once per listing; reactive server updates must not replace local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, owned, terminal]);

  const valuesForSave = () => {
    return {
        title: formData.title,
        make: formData.make,
        model: formData.model,
        year: formData.year ? Number(formData.year) : 0,
        mileage: formData.mileage ? Number(formData.mileage) : 0,
        price: formData.price ? Number(formData.price) : 0,
        vin: formData.vin.trim().toUpperCase() || undefined,
        trim: formData.trim, bodyStyle: formData.bodyStyle, engine: formData.engine,
        transmission: formData.transmission, drivetrain: formData.drivetrain, fuelType: formData.fuelType,
        exteriorColor: formData.exteriorColor, interiorColor: formData.interiorColor,
        mileageUnit: formData.mileageUnit, odometerStatus: formData.odometerStatus, titleStatus: formData.titleStatus,
        sellerState: formData.sellerState, condition: formData.condition,
        mechanicalIssues: formData.mechanicalIssues, accidentDisclosure: formData.accidentDisclosure,
        damageDisclosure: formData.damageDisclosure,
        numberOfOwners: formData.numberOfOwners ? Number(formData.numberOfOwners) : undefined,
        serviceRecords: formData.serviceRecords, modifications: formData.modifications,
        sellerType: formData.sellerType, location: { city: formData.location, state: formData.locationState, latitude: formData.latitude ? Number(formData.latitude) : undefined, longitude: formData.longitude ? Number(formData.longitude) : undefined },
        features: formData.features.split("\n").map((item) => item.trim()).filter(Boolean),
        negotiable: formData.negotiable,
        photos: formData.photos,
        media: media.map(({ id, caption }) => ({ id, caption })),
        description: formData.description,
        contactInfo: formData.contactInfo,
      };
  };
  const snapshot = JSON.stringify({ formData, media });
  const latest = useRef({ snapshot, values: valuesForSave(), mediaBusy });
  const initialSnapshot = useRef(snapshot);
  latest.current = { snapshot, values: valuesForSave(), mediaBusy };
  const canAutosave = !editId || ((!existing && hydratedId.current === editId) || (editable && (existing?.status === "draft" || existing?.status === "rejected")));
  const meaningful = Boolean(listingId.current || snapshot !== initialSnapshot.current);
  const duplicate = useQuery(api.vehicles.checkDuplicateVin,
    isAuthenticated && currentUser && formData.vin.trim().length >= 3
      ? { vin: formData.vin.trim().toUpperCase(), excludeId: listingId.current }
      : "skip");

  const persistDraft = () => {
    const task = saveQueue.current.catch(() => undefined).then(async () => {
      if (!sessionLive()) throw new Error("The listing editor has changed.");
      const next = latest.current;
      if (next.mediaBusy) throw new Error("Finish uploads, or remove failed photos, before saving.");
      if (next.snapshot === savedSnapshot.current && listingId.current) {
        saveBlocked.current = false;
        setSaveStatus("All changes saved");
        return listingId.current;
      }
      setSaveStatus("Saving draft...");
      requestId.current ??= crypto.randomUUID();
      let result = await saveDraft({ ...next.values, id: listingId.current, expectedUpdatedAt: revision.current, clientRequestId: requestId.current });
      if (!sessionLive()) throw new Error("The listing editor has changed.");
      if (result.reused) {
        listingId.current = result.id;
        revision.current = result.updatedAt;
        result = await saveDraft({ ...next.values, id: result.id, expectedUpdatedAt: result.updatedAt });
        if (!sessionLive()) throw new Error("The listing editor has changed.");
      }
      listingId.current = result.id;
      hydratedId.current = result.id;
      revision.current = result.updatedAt;
      requestId.current = undefined;
      savedSnapshot.current = next.snapshot;
      saveBlocked.current = false;
      setSaveStatus(latest.current.snapshot === next.snapshot ? "All changes saved" : "Unsaved changes");
      if (!editId) {
        onDraftCreated(result.id);
        router.replace(`/myAccount/new-listing?edit=${result.id}`, { scroll: false });
      }
      return result.id;
    });
    saveQueue.current = task;
    return task;
  };
  const persistRef = useRef(persistDraft);
  persistRef.current = persistDraft;
  useEffect(() => {
    if (!currentUser || !canAutosave || !meaningful || mediaBusy || isSubmitting || saveBlocked.current || snapshot === savedSnapshot.current || (editId && hydratedId.current !== editId)) return;
    setSaveStatus("Unsaved changes");
    const timer = window.setTimeout(() => {
      if (submissionLock.current || !sessionLive()) return;
      void persistRef.current().catch(error => {
        if (!sessionLive()) return;
        saveBlocked.current = true;
        setSaveStatus("Draft save failed. Retry to save your changes.");
        setErrorMessage(error instanceof Error ? error.message : "Unable to save draft.");
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [snapshot, canAutosave, meaningful, mediaBusy, isSubmitting, currentUser, editId, sessionLive]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current.mediaBusy || latest.current.snapshot !== (savedSnapshot.current || initialSnapshot.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

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


  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (editId && existing === undefined && hydratedId.current !== editId) return <p className="p-8" role="status">Loading listing...</p>;
  if (editId && existing === null) return <p className="p-8" role="alert">This listing is unavailable.</p>;
  if (editId && existing && (!owned || terminal)) return <div className="p-8"><p role="alert">{!owned ? "Only the seller can edit this listing." : "This listing is closed for editing. Reopen an eligible listing from your listings page."}</p><Link href="/myAccount/my-listings" className="mt-4 inline-block text-primary underline">Back to my listings</Link></div>;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, ...(field === "location" || field === "locationState" ? { latitude: "", longitude: "" } : {}), [field]: field === "sellerState" || field === "locationState" ? value.toUpperCase() : value }));
  };
  const useApproximateLocation = () => {
    if (!navigator.geolocation) { setErrorMessage("Location is unavailable in this browser."); return; }
    const city = formData.location, state = formData.locationState;
    navigator.geolocation.getCurrentPosition(position => {
      if (!sessionLive()) return;
      setFormData(previous => previous.location !== city || previous.locationState !== state ? previous : ({ ...previous, latitude: position.coords.latitude.toFixed(2), longitude: position.coords.longitude.toFixed(2) }));
    }, () => { if (sessionLive()) setErrorMessage("Location could not be read. You can continue without distance-search coordinates."); }, { enableHighAccuracy: false, timeout: 10000 });
  };

  const handleDecode = async () => {
    const vin = formData.vin.trim().toUpperCase();
    setIsDecoding(true);
    setErrorMessage("");
    try {
      const result = await decodeVin({ vin });
      if (!sessionLive()) return;
      setFormData((prev) => {
        if (prev.vin.trim().toUpperCase() !== vin) return prev;
        return { ...prev, vin: result.vin, make: result.make, model: result.model,
          year: result.year ? String(result.year) : prev.year,
          trim: result.trim ?? prev.trim, bodyStyle: result.bodyStyle ?? prev.bodyStyle,
          engine: result.engine ?? prev.engine, transmission: result.transmission ?? prev.transmission,
          drivetrain: result.drivetrain ?? prev.drivetrain, fuelType: result.fuelType ?? prev.fuelType };
      });
      setVinMessage("VIN decoded. Review the decoded specifications before submitting.");
    } catch (error) {
      if (sessionLive()) setErrorMessage(error instanceof Error ? error.message : "VIN decoding failed. Please try again.");
    } finally { if (sessionLive()) setIsDecoding(false); }
  };

  const handleSubmit = async (status: "draft" | "pending" = "pending") => {
    if (!currentUser || !editable || !sessionLive() || mediaBusy || isDecoding || submissionLock.current) return;
    submissionLock.current = true;
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      if (canAutosave) {
        const id = await persistDraft();
        if (!sessionLive()) return;
        if (!id) throw new Error("Save your draft before submitting.");
        if (status === "pending") {
          await submitVehicle({ id, expectedUpdatedAt: revision.current });
          if (!sessionLive()) return;
          router.push(`/myAccount/my-listings?submitted=${id}`);
        }
      } else {
        await updateVehicle({ id: editId as Id<"vehicles">, expectedUpdatedAt: revision.current, ...latest.current.values, numberOfOwners: latest.current.values.numberOfOwners ?? null });
        if (!sessionLive()) return;
        savedSnapshot.current = latest.current.snapshot;
        router.push(`/myAccount/my-listings?submitted=${editId}`);
      }
    } catch (error) {
      if (!sessionLive()) return;
      saveBlocked.current = true;
      setSaveStatus("Save failed. Your changes are still in this editor.");
      setErrorMessage(error instanceof Error ? error.message : "Unable to save listing. Please try again.");
    } finally {
      if (sessionLive()) { submissionLock.current = false; setIsSubmitting(false); }
    }
  };

  let specificationError = "";
  try {
    validateVehicle(valuesForSave(), true);
  } catch (error) {
    specificationError = error instanceof Error ? error.message : "Complete the required listing information.";
  }

  return (
    <div className="market-page min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {editId ? "Edit Your Vehicle" : "List Your Vehicle"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">Before submitting, verify your seller contact details and attest vehicle ownership in <Link href="/myAccount/safety" className="underline text-primary">Trust & safety</Link>. Private ownership documents belong there.</p>
          <p className="text-gray-600">
            {canAutosave ? "Your draft saves automatically. Preview your listing before submitting it for review." : "Preview your changes and submit them for review when you are ready."}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center space-x-2 ${step >= 1 ? "text-primary" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 1
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                1
              </div>
              <span className="text-sm font-medium">Vehicle Details</span>
            </div>
            <div className="flex-1 h-px bg-gray-200"></div>
            <div
              className={`flex items-center space-x-2 ${step >= 2 ? "text-primary" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 2
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                2
              </div>
              <span className="text-sm font-medium">Description & Photos</span>
            </div>
            <div className="flex-1 h-px bg-gray-200"></div>
            <div
              className={`flex items-center space-x-2 ${step >= 3 ? "text-primary" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= 3
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                3
              </div>
              <span className="text-sm font-medium">Review & Submit</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Step {step}:{" "}
              {step === 1
                ? "Vehicle Information"
                : step === 2
                  ? "Description & Photos"
                  : "Review & Submit"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset disabled={isSubmitting} className="space-y-6 min-w-0">
            {errorMessage && <p role="alert" className="text-red-700">{errorMessage}</p>}
            {canAutosave && <p role="status" className="text-sm text-muted-foreground">{saveStatus}</p>}
            {existing?.status === "rejected" && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4"><h3 className="font-semibold">Changes requested</h3><p className="mt-1 text-sm">{existing.moderationReason || "Review your listing and resubmit for moderation."}</p></div>}
            {canAutosave && <Button variant="outline" disabled={isSubmitting || isDecoding || mediaBusy || !meaningful} onClick={() => handleSubmit("draft")}>
              {isSubmitting ? "Saving..." : "Save Draft"}
            </Button>}
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Listing Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., 2020 Honda Civic - Excellent Condition"
                      value={formData.title}
                      onChange={(e) =>
                        handleInputChange("title", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="make">Make *</Label>
                    <Select
                      value={formData.make}
                      onValueChange={(value) =>
                        handleInputChange("make", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select make" />
                      </SelectTrigger>
                      <SelectContent>
                        {(formData.make && !makes.includes(formData.make) ? [formData.make, ...makes] : makes).map((make) => (
                          <SelectItem key={make} value={make}>
                            {make}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Model *</Label>
                    <Input
                      id="model"
                      placeholder="e.g., Civic"
                      value={formData.model}
                      onChange={(e) =>
                        handleInputChange("model", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input id="year" type="number" step={1} min={1886} max={currentYear + 1} value={formData.year} onChange={(e) => handleInputChange("year", e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mileage">Mileage *</Label>
                    <Input
                      id="mileage"
                      type="number" min={0} step={1}
                      placeholder="e.g., 50000"
                      value={formData.mileage}
                      onChange={(e) =>
                        handleInputChange("mileage", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Price ($) *</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="e.g., 25000"
                      value={formData.price}
                      onChange={(e) =>
                        handleInputChange("price", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vin">VIN *</Label>
                    <Input
                      id="vin"
                      placeholder="17-character VIN (or pre-1981 serial number)"
                      value={formData.vin}
                      onChange={(e) => { handleInputChange("vin", e.target.value.toUpperCase()); setVinMessage("Not verified"); }}
                    />
                    <Button type="button" variant="outline" onClick={handleDecode} disabled={isDecoding || !/^[A-HJ-NPR-Z0-9]{17}$/.test(formData.vin.trim())}>
                      {isDecoding ? "Decoding..." : "Decode VIN"}
                    </Button>
                    <p className="text-sm text-gray-600" role="status">{vinMessage}</p>
                    {duplicate?.duplicate && <p role="alert" className="text-sm text-red-700">A current listing already uses this VIN. Resolve the duplicate before submitting.</p>}
                  </div>
                  <p className="text-sm text-gray-600 md:col-span-2">Complete each specification. Enter Unknown if a specification is unavailable.</p>
                  {([ ["trim", "Trim"], ["bodyStyle", "Body style"], ["engine", "Engine"], ["transmission", "Transmission"], ["drivetrain", "Drivetrain"], ["fuelType", "Fuel type"], ["exteriorColor", "Exterior color"], ["interiorColor", "Interior color"] ] as const).map(([field, label]) => (
                    <div className="space-y-2" key={field}>
                      <Label htmlFor={field}>{label}</Label>
                      <Input id={field} value={formData[field]} onChange={(e) => handleInputChange(field, e.target.value)} />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <Label htmlFor="mileageUnit">Mileage unit *</Label>
                    <select id="mileageUnit" className="w-full rounded-md border p-2" value={formData.mileageUnit} onChange={(e) => handleInputChange("mileageUnit", e.target.value)}>
                      <option value="mi">Miles</option><option value="km">Kilometers</option>
                    </select>
                  </div>
                  <div className="space-y-2"><Label htmlFor="odometerStatus">Mileage declaration</Label><select id="odometerStatus" className="w-full rounded-md border p-2" value={formData.odometerStatus} onChange={(e) => handleInputChange("odometerStatus", e.target.value)}><option value="actual">Actual mileage</option><option value="exempt">Odometer exempt</option><option value="not_actual">Not actual mileage</option></select></div>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.negotiable} onChange={(e) => setFormData((prev) => ({ ...prev, negotiable: e.target.checked }))} /> Asking price is negotiable</label>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)}>
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            <div className={step === 2 ? "" : "hidden"}>
              <VehicleMediaEditor value={media} legacyPhotos={formData.photos} onChange={setMedia} onLegacyChange={photos => setFormData(previous => ({ ...previous, photos }))} onBusyChange={setMediaBusy} disabled={isSubmitting} />
            </div>

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {([ ["sellerState", "Seller state *"], ["location", "Vehicle city *"], ["locationState", "Vehicle state *"], ["numberOfOwners", "Number of owners (leave blank if unknown)"] ] as const).map(([field, label]) => (
                    <div className="space-y-2" key={field}><Label htmlFor={field}>{label}</Label><Input id={field} type={field === "numberOfOwners" ? "number" : "text"} min={field === "numberOfOwners" ? 1 : undefined} value={formData[field]} onChange={(e) => handleInputChange(field, e.target.value)} /></div>
                  ))}
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-sm font-medium">Distance-search location (optional)</p>
                    <p className="text-xs text-muted-foreground">Use this while you are near the vehicle. Coordinates are rounded to roughly a mile and visible publicly; they do not show your street address.</p>
                    <Button type="button" variant="outline" onClick={useApproximateLocation}>Use my approximate location</Button>
                    {formData.latitude && formData.longitude && <div className="flex items-center gap-3 text-xs"><span>Approximate coordinates: {formData.latitude}, {formData.longitude}</span><Button type="button" size="sm" variant="ghost" onClick={() => setFormData(previous => ({ ...previous, latitude: "", longitude: "" }))}>Remove</Button></div>}
                  </div>
                  <div className="space-y-2"><Label htmlFor="titleStatus">Title status</Label><select id="titleStatus" className="w-full rounded-md border p-2" value={formData.titleStatus} onChange={(e) => handleInputChange("titleStatus", e.target.value)}>{["clean", "rebuilt", "salvage", "flood", "lemon", "other", "unknown"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="condition">Condition</Label><select id="condition" className="w-full rounded-md border p-2" value={formData.condition} onChange={(e) => handleInputChange("condition", e.target.value)}>{["excellent", "good", "fair", "poor"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="sellerType">Seller type</Label><select id="sellerType" className="w-full rounded-md border p-2" value={formData.sellerType} onChange={(e) => handleInputChange("sellerType", e.target.value)}><option value="private">Private seller</option></select></div>
                  <div className="space-y-2"><Label htmlFor="serviceRecords">Service records</Label><select id="serviceRecords" className="w-full rounded-md border p-2" value={formData.serviceRecords} onChange={(e) => handleInputChange("serviceRecords", e.target.value)}><option value="unknown">Unknown</option><option value="available">Available</option><option value="partial">Partial records</option><option value="unavailable">Unavailable</option></select></div>
                </div>
                {([ ["mechanicalIssues", "Known mechanical issues * (write None or Unknown if applicable)"], ["accidentDisclosure", "Accident disclosure"], ["damageDisclosure", "Damage disclosure"], ["modifications", "Modifications * (write None if unmodified)"], ["features", "Features / options (one per line)"] ] as const).map(([field, label]) => (
                  <div className="space-y-2" key={field}><Label htmlFor={field}>{label}</Label><Textarea id={field} value={formData[field]} onChange={(e) => handleInputChange(field, e.target.value)} /></div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your vehicle's condition, features, and any important details..."
                    rows={6}
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactInfo">Contact Information *</Label>
                  <Input
                    id="contactInfo"
                    placeholder="e.g., Phone: (555) 123-4567, Email: seller@example.com"
                    value={formData.contactInfo}
                    onChange={(e) =>
                      handleInputChange("contactInfo", e.target.value)
                    }
                  />
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Previous Step
                  </Button>
                  <Button onClick={() => setStep(3)}>
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="mb-6 text-left">
                    <VehiclePhotoCarousel photos={media.map(photo => photo.url)} thumbnailPhotos={media.map(photo => photo.thumbnailUrl)} captions={media.map(photo => photo.caption)} title={formData.title} vehicleLabel={`${formData.year} ${formData.make} ${formData.model}`} />
                    <h3 className="mt-6 text-2xl font-semibold">{formData.title}</h3>
                    <p className="mt-2 text-lg">${Number(formData.price).toLocaleString()} {formData.negotiable && "· Negotiable"}</p>
                    <p className="mt-2 text-muted-foreground">{formData.location}, {formData.locationState}</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-3">{[["Mileage", `${formData.mileage} ${formData.mileageUnit}`], ["Engine", formData.engine], ["Transmission", formData.transmission], ["Drivetrain", formData.drivetrain], ["Title", formData.titleStatus], ["Condition", formData.condition]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl>
                    <p className="mt-4 whitespace-pre-wrap">{formData.description}</p>
                    <details className="mt-4 rounded-lg border p-4"><summary className="cursor-pointer font-medium">Review seller disclosures</summary><dl className="mt-4 space-y-3">{[["VIN", formData.vin], ["Mechanical issues", formData.mechanicalIssues], ["Accidents", formData.accidentDisclosure], ["Damage", formData.damageDisclosure], ["Modifications", formData.modifications], ["Service records", formData.serviceRecords], ["Owners", formData.numberOfOwners || "Unknown"], ["Mileage declaration", formData.odometerStatus], ["Seller state", formData.sellerState], ["Features", formData.features || "None provided"]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}</dl></details>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Preview your listing
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Your vehicle listing will be reviewed by our team before
                    being published. Once approved, you can register for
                    upcoming events.
                  </p>

                  <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Listing Summary
                    </h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Title:</strong> {formData.title}
                      </p>
                      <p>
                        <strong>Vehicle:</strong> {formData.year}{" "}
                        {formData.make} {formData.model}
                      </p>
                      <p>
                        <strong>Mileage:</strong> {formData.mileage} {formData.mileageUnit}
                      </p>
                      <p>
                        <strong>Price:</strong> ${formData.price}
                      </p>
                      <p>
                        <strong>Photos:</strong> {formData.photos.length + media.length}{" "}
                        uploaded
                      </p>
                    </div>
                  </div>

                  {Boolean(specificationError) && <p role="alert" className="mb-4 text-sm text-red-700">{specificationError}. Complete the required information before submitting.</p>}
                  {duplicate?.duplicate && <p role="alert" className="mb-4 text-sm text-red-700">A current listing already uses this VIN. Resolve the duplicate before submitting.</p>}
                  {(!media.length || formData.photos.length > 0 || mediaBusy) && <p role="alert" className="mb-4 text-sm text-red-700">Upload at least one permanent photo, replace all legacy photos, and finish or remove failed uploads before submitting.</p>}
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Previous Step
                    </Button>
                    <Button onClick={() => handleSubmit("pending")} disabled={isSubmitting || isDecoding || mediaBusy || Boolean(specificationError) || !media.length || formData.photos.length > 0 || duplicate?.duplicate}>
                      {isSubmitting ? "Submitting..." : existing?.status === "rejected" ? "Resubmit for review" : "Submit for review"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
