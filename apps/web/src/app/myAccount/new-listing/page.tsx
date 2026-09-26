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
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { Car, Upload } from "lucide-react";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";

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
const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

export default function NewListingPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user: currentUser } = useCurrentUser();
  const { user } = useUser();

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
    photos: [] as string[],
  });

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

  // Always call hooks to maintain hook order
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);
  const createVehicle = useMutation(api.vehicles.createVehicle);

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
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = async () => {
    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      const vehicleId = await createVehicle({
        userId: currentUser._id,
        title: formData.title,
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year),
        mileage: parseInt(formData.mileage),
        price: parseFloat(formData.price),
        vin: formData.vin || undefined,
        photos: formData.photos,
        description: formData.description,
        contactInfo: formData.contactInfo,
      });

      router.push(`/myAccount/my-listings?created=${vehicleId}`);
    } catch (error) {
      console.error("Error creating vehicle:", error);
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
    formData.price;
  const isStep2Valid = formData.description && formData.contactInfo;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            List Your Vehicle
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
              <span className="text-sm font-medium">Event Registration</span>
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
                  : "Event Registration"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    <Select
                      value={formData.year}
                      onValueChange={(value) =>
                        handleInputChange("year", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label htmlFor="vin">VIN (Optional)</Label>
                    <Input
                      id="vin"
                      placeholder="17-character VIN"
                      value={formData.vin}
                      onChange={(e) => handleInputChange("vin", e.target.value)}
                    />
                  </div>
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
                          <img
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
                        <strong>Mileage:</strong> {formData.mileage} miles
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
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
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
