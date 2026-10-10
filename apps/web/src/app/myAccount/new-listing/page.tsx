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
import { Car, Upload } from "lucide-react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import type { Id } from "@/convex/_generated/dataModel";

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
  return <Suspense fallback={<p className="p-8">Loading listing...</p>}><ListingForm /></Suspense>;
}

function ListingForm() {
  const editId = useSearchParams().get("edit");
  const existing = useQuery(api.vehicles.getVehicleById, editId ? { id: editId as Id<"vehicles"> } : "skip");
  const updateVehicle = useMutation(api.vehicles.updateVehicle);
  const changeStatus = useMutation(api.vehicles.changeVehicleStatus);
  const router = useRouter();
  const { isLoading, isAuthenticated, user: currentUser } = useCurrentUser();
  const createVehicle = useMutation(api.vehicles.createVehicle);

  const decodeVin = useAction(api.vin.decodeVin);
  const [isDecoding, setIsDecoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [vinMessage, setVinMessage] = useState("Not verified");

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
    serviceRecords: "unknown" as "available" | "partial" | "unavailable" | "unknown", modifications: "", sellerType: "private" as "private" | "dealer", location: "", locationState: "", postalCode: "",
    features: "", negotiable: false,
    photos: [] as string[],
  });

  useEffect(() => {
    if (!existing) return;
    setFormData((prev) => ({
      ...prev, title: existing.title, make: existing.make, model: existing.model,
      year: existing.year ? String(existing.year) : "", mileage: String(existing.mileage), price: String(existing.price),
      vin: existing.vin ?? "", description: existing.description, contactInfo: existing.contactInfo,
      photos: existing.photos, trim: existing.trim ?? "", bodyStyle: existing.bodyStyle ?? "",
      engine: existing.engine ?? "", transmission: existing.transmission ?? "", drivetrain: existing.drivetrain ?? "",
      fuelType: existing.fuelType ?? "", exteriorColor: existing.exteriorColor ?? "", interiorColor: existing.interiorColor ?? "",
      mileageUnit: existing.mileageUnit ?? "mi", odometerStatus: existing.odometerStatus ?? "actual",
      titleStatus: existing.titleStatus ?? "unknown", sellerState: existing.sellerState ?? "",
      condition: existing.condition ?? "good", mechanicalIssues: existing.mechanicalIssues ?? "",
      accidentDisclosure: existing.accidentDisclosure ?? "unknown", damageDisclosure: existing.damageDisclosure ?? "unknown",
      numberOfOwners: existing.numberOfOwners ? String(existing.numberOfOwners) : "", serviceRecords: existing.serviceRecords ?? "unknown",
      modifications: existing.modifications ?? "", sellerType: existing.sellerType ?? "private",
      location: existing.location?.city ?? "", locationState: existing.location?.state ?? "", postalCode: existing.location?.postalCode ?? "",
      features: existing.features?.join("\n") ?? "", negotiable: existing.negotiable ?? false,
    }));
    setVinMessage(existing.vinVerificationStatus === "decoded" ? "VIN decoded with Auto.dev" : "Not verified");
  }, [existing]);

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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: field === "sellerState" || field === "locationState" ? value.toUpperCase() : value }));
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      // In a real app, you'd upload to Convex file storage
      // For now, we'll simulate with placeholder URLs
      const newPhotos = Array.from(files).map((file) =>
        URL.createObjectURL(file)
      );
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos],
      }));
    }
  };

  const handleDecode = async () => {
    const vin = formData.vin.trim().toUpperCase();
    setIsDecoding(true);
    setErrorMessage("");
    try {
      const result = await decodeVin({ vin });
      setFormData((prev) => {
        if (prev.vin.trim().toUpperCase() !== vin) return prev;
        return { ...prev, vin: result.vin, make: result.make, model: result.model,
          year: result.year ? String(result.year) : prev.year,
          trim: result.trim ?? prev.trim, bodyStyle: result.bodyStyle ?? prev.bodyStyle,
          engine: result.engine ?? prev.engine, transmission: result.transmission ?? prev.transmission,
          drivetrain: result.drivetrain ?? prev.drivetrain, fuelType: result.fuelType ?? prev.fuelType };
      });
      setVinMessage("VIN decoded with Auto.dev. Review the decoded specifications before submitting.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "VIN decoding failed. Please try again.");
    } finally { setIsDecoding(false); }
  };

  const handleSubmit = async (status: "draft" | "pending" = "pending") => {
    if (!currentUser) return;

    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const values = {
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
        sellerType: formData.sellerType, location: { city: formData.location, state: formData.locationState, postalCode: formData.postalCode || undefined },
        features: formData.features.split("\n").map((item) => item.trim()).filter(Boolean),
        negotiable: formData.negotiable, status,
        photos: formData.photos,
        description: formData.description,
        contactInfo: formData.contactInfo,
      };
      let vehicleId;
      if (editId) {
        const { status: targetStatus, ...updates } = values;
        const id = editId as Id<"vehicles">;
        await updateVehicle({ id, ...updates, numberOfOwners: updates.numberOfOwners ?? null });
        if (existing?.status === "draft" && targetStatus === "pending") await changeStatus({ id, status: "pending" });
        vehicleId = id;
      } else { vehicleId = await createVehicle(values); }

      router.push(`/myAccount/my-listings?created=${vehicleId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid =
    formData.title &&
    formData.make &&
    formData.model &&
    formData.year &&
    formData.mileage &&
    formData.price && formData.vin && Number(formData.year) >= 1886 && Number(formData.mileage) >= 0 && Number(formData.price) > 0 &&
    [formData.trim, formData.bodyStyle, formData.engine, formData.transmission, formData.drivetrain, formData.fuelType, formData.exteriorColor, formData.interiorColor].every((value) => value.trim());
  const isStep2Valid = formData.description.trim().length >= 20 && formData.contactInfo.trim().length >= 3 && formData.location && /^[A-Z]{2}$/.test(formData.locationState) && /^[A-Z]{2}$/.test(formData.sellerState) && formData.mechanicalIssues.trim() && formData.accidentDisclosure.trim() && formData.damageDisclosure.trim() && formData.modifications.trim();

  return (
    <div className="market-page min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {editId ? "Edit Your Vehicle" : "List Your Vehicle"}
          </h1>
          <p className="text-gray-600">
            Create a new vehicle listing to showcase at our events
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
          <CardContent className="space-y-6">
            {errorMessage && <p role="alert" className="text-red-700">{errorMessage}</p>}
            {(!editId || existing?.status === "draft") && <Button variant="outline" disabled={isSubmitting || !formData.title.trim()} onClick={() => handleSubmit("draft")}>
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
                        {makes.map((make) => (
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
                    <Input id="year" type="number" min={1886} max={currentYear + 1} value={formData.year} onChange={(e) => handleInputChange("year", e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mileage">Mileage *</Label>
                    <Input
                      id="mileage"
                      type="number"
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
                      {isDecoding ? "Decoding..." : "Decode VIN with Auto.dev"}
                    </Button>
                    <p className="text-sm text-gray-600" role="status">{vinMessage}</p>
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
                  <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {([ ["sellerState", "Seller state *"], ["location", "Vehicle city *"], ["locationState", "Vehicle state *"], ["postalCode", "Postal code"], ["numberOfOwners", "Number of owners (leave blank if unknown)"] ] as const).map(([field, label]) => (
                    <div className="space-y-2" key={field}><Label htmlFor={field}>{label}</Label><Input id={field} type={field === "numberOfOwners" ? "number" : "text"} min={field === "numberOfOwners" ? 1 : undefined} value={formData[field]} onChange={(e) => handleInputChange(field, e.target.value)} /></div>
                  ))}
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

                <div className="space-y-2">
                  <Label>Photos</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Upload photos of your vehicle
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <Button asChild variant="outline">
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        Choose Photos
                      </label>
                    </Button>
                  </div>

                  {formData.photos.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {formData.photos.map((photo, index) => (
                        <div key={index} className="relative">
                          <Image
                            unoptimized
                            width={800}
                            height={600}
                            src={photo}
                            alt={`Vehicle photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Previous Step
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!isStep2Valid}>
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Car className="h-16 w-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Ready to Submit?
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
                        <strong>Photos:</strong> {formData.photos.length}{" "}
                        uploaded
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Previous Step
                    </Button>
                    <Button onClick={() => handleSubmit("pending")} disabled={isSubmitting}>
                      {isSubmitting ? "Creating Listing..." : "Create Listing"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
