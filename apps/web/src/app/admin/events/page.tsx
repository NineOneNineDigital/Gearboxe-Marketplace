"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Calendar, MapPin, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { redirect, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminEventsPage() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [showCreateForm, setShowCreateForm] = useState(false);

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
  const allEvents = useQuery(api.admin.getAllEvents);
  const cities = useQuery(api.cities.getCities);
  const deleteEvent = useMutation(api.events.deleteEvent);

  if (isAdmin === false) {
    redirect("/myAccount");
  }

  if (isAdmin === undefined || !allEvents || !cities) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (confirm("Are you sure you want to delete this event?")) {
      try {
        await deleteEvent({ id: eventId as any });
      } catch (error) {
        console.error("Error deleting event:", error);
      }
    }
  };

  const selectedEventId = searchParams.get("event");
  const selectedEvent = selectedEventId
    ? allEvents.find((e) => e._id === selectedEventId)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Events</h1>
            <p className="text-gray-600">Create and manage car market events</p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-5 w-5 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Create Event Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Event</CardTitle>
          </CardHeader>
          <CardContent>
            <EventCreateForm
              cities={cities}
              onSuccess={() => {
                setShowCreateForm(false);
                // Refresh the page to show new event
                window.location.reload();
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Events Grid */}
      {allEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allEvents.map((event) => (
            <Card key={event._id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-xl line-clamp-1">
                      {event.name}
                    </h3>
                    {event.city && (
                      <p className="text-sm text-gray-600">
                        {event.city.name}, {event.city.state}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>Capacity: {event.capacity} vendors</span>
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {event.description}
                    </p>
                  )}

                  <div className="flex space-x-2 pt-4">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Link href={`/events/${event._id}`}>
                        <Calendar className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEvent(event._id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-16">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Events Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first car market event to get started.
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Create First Event
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Event Create Form Component
function EventCreateForm({
  cities,
  onSuccess,
}: {
  cities: any[];
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    cityId: "",
    name: "",
    date: "",
    location: "",
    address: "",
    capacity: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createEvent = useMutation(api.events.createEvent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.cityId ||
      !formData.name ||
      !formData.date ||
      !formData.location ||
      !formData.address ||
      !formData.capacity
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createEvent({
        cityId: formData.cityId as any,
        name: formData.name,
        date: new Date(formData.date).getTime(),
        location: formData.location,
        address: formData.address,
        capacity: parseInt(formData.capacity),
        description: formData.description,
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">City *</label>
          <select
            value={formData.cityId}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, cityId: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          >
            <option value="">Select a city</option>
            {cities.map((city) => (
              <option key={city._id} value={city._id}>
                {city.name}, {city.state}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Event Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="e.g., Raleigh Car Market - March 2024"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Date *</label>
          <input
            type="datetime-local"
            value={formData.date}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, date: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Capacity *
          </label>
          <input
            type="number"
            value={formData.capacity}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, capacity: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="e.g., 50"
            min="1"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Location *
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, location: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="e.g., Raleigh Convention Center"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Address *</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="e.g., 500 S Salisbury St, Raleigh, NC 27601"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          rows={4}
          placeholder="Describe the event, parking information, etc."
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFormData({
              cityId: "",
              name: "",
              date: "",
              location: "",
              address: "",
              capacity: "",
              description: "",
            });
          }}
        >
          Clear Form
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating Event..." : "Create Event"}
        </Button>
      </div>
    </form>
  );
}
