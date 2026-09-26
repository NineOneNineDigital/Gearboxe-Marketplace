"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRScannerComponent } from "@/components/ui/qr-scanner";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Calendar, Car, CheckCircle, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function AdminCheckinPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);

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

  const isAdmin = useQuery(api.users.isAdmin);
  const upcomingEvents = useQuery(api.events.getUpcomingEvents);
  const eventRegistrations = selectedEvent
    ? useQuery(api.registrations.getRegistrationsByEvent, {
        eventId: selectedEvent as any,
      })
    : null;
  const checkInRegistration = useMutation(
    api.registrations.checkInRegistration
  );

  if (isAdmin === false) {
    redirect("/myAccount");
  }

  if (isAdmin === undefined || !upcomingEvents) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const handleQRScan = async (data: string) => {
    setScannedData(data);
    // In a real app, you'd validate the QR code and check in the user
    // For now, we'll just show the scanned data
  };

  const handleManualCheckIn = async (registrationId: string) => {
    try {
      await checkInRegistration({ id: registrationId as any });
      // Refresh the registrations list
      window.location.reload();
    } catch (error) {
      console.error("Error checking in registration:", error);
    }
  };

  const selectedEventData = selectedEvent
    ? upcomingEvents.find((e) => e._id === selectedEvent)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Event Check-in</h1>
        <p className="text-gray-600">
          Scan QR codes or manually check in vendors
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Event Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Event</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <button
                      key={event._id}
                      onClick={() => setSelectedEvent(event._id)}
                      className={`w-full text-left p-3 border rounded-lg transition-colors ${
                        selectedEvent === event._id
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {event.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {new Date(event.date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {event.location}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No upcoming events</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Scanner */}
          {selectedEvent && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>QR Code Scanner</CardTitle>
              </CardHeader>
              <CardContent>
                <QRScannerComponent
                  onScan={handleQRScan}
                  title="Scan Vendor QR Code"
                />

                {scannedData && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Scanned Data:
                    </p>
                    <p className="text-xs text-gray-600 break-all">
                      {scannedData}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Registrations List */}
        <div className="lg:col-span-2">
          {selectedEvent ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Registrations for {selectedEventData?.name}
                  {eventRegistrations && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      ({eventRegistrations.length} total)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventRegistrations && eventRegistrations.length > 0 ? (
                  <div className="space-y-4">
                    {eventRegistrations.map((registration) => (
                      <div
                        key={registration._id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <Car className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {registration.vehicle?.title}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {registration.vehicle?.year}{" "}
                                {registration.vehicle?.make}{" "}
                                {registration.vehicle?.model}
                              </p>
                              <p className="text-xs text-gray-500">
                                Vendor: {registration.user?.name}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              registration.checkedIn
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {registration.checkedIn
                              ? "Checked In"
                              : "Not Checked In"}
                          </span>

                          {!registration.checkedIn && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleManualCheckIn(registration._id)
                              }
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Check In
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      No registrations for this event
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-16">
                <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Select an Event
                </h3>
                <p className="text-gray-600">
                  Choose an event from the list to view and manage registrations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
