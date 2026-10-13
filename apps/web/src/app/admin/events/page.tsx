"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Calendar, MapPin, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useState } from "react";

export default function AdminEventsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdmin = useQuery(api.users.isAdmin);
  const allEvents = useQuery(api.admin.getAllEvents, isAdmin === true ? {} : "skip");
  const cities = useQuery(api.cities.getCities);
  const staffCandidates = useQuery(api.admin.getAllUsers, isAdmin === true ? {} : "skip");
  const deleteEvent = useMutation(api.events.deleteEvent);
  const cancelEvent = useMutation(api.eventBookings.cancelEvent);
  const [actionError, setActionError] = useState("");
  const [busyEvent, setBusyEvent] = useState("");


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
        await deleteEvent({ id: eventId as Id<"events"> });
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to delete event.");
      }
    }
  };


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

      {actionError && <p role="alert" className="mb-4 text-red-700">{actionError}</p>}
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

                  {event.cancelledAt ? <p className="text-sm text-red-700">Cancelled: {event.cancellationReason}</p> : <Button variant="outline" disabled={!!busyEvent} onClick={async () => {
                    const reason = window.prompt("Reason for cancelling this event (all paid registrations will receive a full refund):");
                    if (!reason?.trim()) return;
                    if (!window.confirm("Cancel the event and automatically refund every paid registration?")) return;
                    setBusyEvent(event._id); setActionError("");
                    try { await cancelEvent({ eventId: event._id, reason: reason.trim() }); } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to cancel event."); } finally { setBusyEvent(""); }
                  }}>{busyEvent === event._id ? "Cancelling…" : "Cancel event and refund registrations"}</Button>}
                  <EventOperationsSettings event={event} users={staffCandidates ?? []} />
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
  cities: Doc<"cities">[];
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
    registrationFee: "49.00", timeZone: "America/New_York", registrationDeadline: "", eventRules: "", vendorInstructions: "", contactName: "", contactPhone: "", contactEmail: "", onSiteContactVisibility: "vendors",
  });
  const [formError, setFormError] = useState("");
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
        cityId: formData.cityId as Id<"cities">,
        name: formData.name,
        date: new Date(formData.date).getTime(),
        location: formData.location,
        address: formData.address,
        capacity: parseInt(formData.capacity),
        description: formData.description,
        registrationFeeCents: Math.round(Number(formData.registrationFee) * 100), timeZone: formData.timeZone,
        registrationDeadline: formData.registrationDeadline ? new Date(formData.registrationDeadline).getTime() : undefined,
        eventRules: formData.eventRules || undefined, vendorInstructions: formData.vendorInstructions || undefined,
        onSiteContact: formData.contactName && formData.contactPhone ? { name: formData.contactName, phone: formData.contactPhone, email: formData.contactEmail || undefined } : undefined,
        onSiteContactVisibility: formData.onSiteContactVisibility as "vendors" | "public",
      });
      onSuccess();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to create event.");
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {([['registrationFee', 'Registration fee (USD)', 'number'], ['timeZone', 'Event time zone (IANA)', 'text'], ['registrationDeadline', 'Registration deadline (your local time)', 'datetime-local'], ['contactName', 'On-site contact name', 'text'], ['contactPhone', 'On-site contact phone', 'tel'], ['contactEmail', 'On-site contact email', 'email']] as const).map(([key, label, type]) => <label key={key} className="space-y-2"><span className="block text-sm font-medium">{label}</span><input className="w-full rounded border p-2" type={type} step={key === 'registrationFee' ? '0.01' : undefined} min={key === 'registrationFee' ? '0.50' : undefined} required={key === 'registrationFee' || key === 'timeZone'} value={formData[key]} onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))} /></label>)}
      </div>
      <p className="text-sm text-muted-foreground">Date and deadline inputs use your device time zone; the event time zone controls event-day and refund calculations.</p>
      {(['eventRules', 'vendorInstructions'] as const).map(key => <label key={key} className="block space-y-2"><span className="block font-medium">{key === 'eventRules' ? 'Event rules' : 'Vendor instructions'}</span>{key === 'vendorInstructions' && <span className="block text-sm text-muted-foreground">Public information: omit private access codes and personal contact details.</span>}<textarea className="w-full rounded border p-2" maxLength={5000} value={formData[key]} onChange={e => setFormData(prev => ({...prev, [key]: e.target.value}))} /></label>)}
      <label className="block space-y-2"><span className="block font-medium">On-site contact visibility</span><select className="rounded border p-2" value={formData.onSiteContactVisibility} onChange={e => setFormData(prev => ({...prev, onSiteContactVisibility: e.target.value}))}><option value="vendors">Confirmed vendors and assigned staff</option><option value="public">Public — contact phone and email visible to everyone</option></select></label>
      {formError && <p role="alert" className="text-red-700">{formError}</p>}
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
    registrationFee: "49.00", timeZone: "America/New_York", registrationDeadline: "", eventRules: "", vendorInstructions: "", contactName: "", contactPhone: "", contactEmail: "", onSiteContactVisibility: "vendors",
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

function EventOperationsSettings({ event, users }: { event: Doc<"events">; users: Doc<"users">[] }) {
  const update = useMutation(api.events.updateEvent);
  const assign = useMutation(api.eventOperations.assignStaff);
  const remove = useMutation(api.eventOperations.removeStaff);
  const staff = useQuery(api.eventOperations.listStaff, { eventId: event._id });
  const [form, setForm] = useState({ registrationFee: event.registrationFeeCents !== undefined ? String(event.registrationFeeCents / 100) : "", timeZone: event.timeZone ?? "America/New_York", capacity: String(event.capacity), deadline: event.registrationDeadline ? new Date(event.registrationDeadline - new Date(event.registrationDeadline).getTimezoneOffset() * 60000).toISOString().slice(0,16) : "", rules: event.eventRules ?? "", instructions: event.vendorInstructions ?? "", contactName: event.onSiteContact?.name ?? "", contactPhone: event.onSiteContact?.phone ?? "", contactEmail: event.onSiteContact?.email ?? "", visibility: event.onSiteContactVisibility ?? "vendors" });
  const [clearDeadline,setClearDeadline] = useState(false); const [clearContact,setClearContact] = useState(false);
  const [userId,setUserId] = useState(""); const [role,setRole] = useState<"checkin"|"manager">("checkin"); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  async function perform(operation: () => Promise<unknown>) { setBusy(true); setError(""); try { await operation(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to update event."); } finally { setBusy(false); } }
  return <details className="rounded border p-3"><summary className="cursor-pointer font-medium">Operations settings and staff</summary><form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); void perform(() => update({ id: event._id, registrationFeeCents: Math.round(Number(form.registrationFee) * 100), timeZone: form.timeZone, capacity: Number(form.capacity), clearRegistrationDeadline: clearDeadline, clearOnSiteContact: clearContact, registrationDeadline: !clearDeadline && form.deadline && new Date(form.deadline).getTime() !== event.registrationDeadline ? new Date(form.deadline).getTime() : undefined, eventRules: form.rules, vendorInstructions: form.instructions, onSiteContact: !clearContact && form.contactName && form.contactPhone ? { name: form.contactName, phone: form.contactPhone, email: form.contactEmail || undefined } : undefined, onSiteContactVisibility: form.visibility as "vendors"|"public" })); }}>
    {([['registrationFee','Fee (USD)','number'],['timeZone','Time zone','text'],['capacity','Capacity','number'],['deadline','Registration deadline (device time zone)','datetime-local'],['contactName','On-site contact name','text'],['contactPhone','On-site contact phone','tel'],['contactEmail','On-site contact email','email']] as const).map(([key,label,type]) => <label className="block" key={key}><span className="block text-sm">{label}</span><input type={type} required={key === 'registrationFee' || key === 'capacity' || key === 'timeZone'} step={key === 'registrationFee' ? '0.01' : undefined} className="w-full rounded border p-2" value={form[key]} onChange={e => setForm(prev => ({...prev,[key]: e.target.value}))} /></label>)}
    {(['rules','instructions'] as const).map(key => <label key={key} className="block"><span>{key === 'rules' ? 'Event rules' : 'Vendor instructions'}</span>{key === 'instructions' && <span className="block text-sm text-muted-foreground">Public information: omit private access codes and personal contact details.</span>}<textarea className="w-full rounded border p-2" maxLength={5000} value={form[key]} onChange={e => setForm(prev => ({...prev,[key]: e.target.value}))} /></label>)}
    <label className="block"><input type="checkbox" checked={clearDeadline} onChange={e => setClearDeadline(e.target.checked)} /> Remove registration deadline (new registration stays open until the event)</label>
    <label className="block"><input type="checkbox" checked={clearContact} onChange={e => setClearContact(e.target.checked)} /> Remove on-site contact</label>
    <p className="text-sm">Blank deadline and contact fields preserve existing values unless removal is selected.</p>
    <label className="block">Contact visibility<select className="block w-full rounded border p-2" value={form.visibility} onChange={e => setForm(prev => ({...prev, visibility: e.target.value as "vendors"|"public"}))}><option value="vendors">Confirmed vendors and staff</option><option value="public">Public phone and email — everyone</option></select></label><Button disabled={busy || !!event.cancelledAt}>Save settings</Button>
  </form><div className="mt-4 space-y-2"><h4 className="font-semibold">Event staff</h4>{staff?.map(row => <div key={row._id}><span>{row.name} · {row.role}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => perform(() => remove({eventId:event._id,userId:row.userId}))}>Remove</Button></div>)}<label className="block">Assign an existing account<select className="block w-full rounded border p-2" value={userId} onChange={e => setUserId(e.target.value)}><option value="">Select staff member</option>{users.filter(user => user.suspendedAt === undefined).map(user => <option key={user._id} value={user._id}>{user.name} ({user.email})</option>)}</select></label><select className="rounded border p-2" value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="checkin">Check-in only</option><option value="manager">Event manager</option></select><Button disabled={busy || !userId.trim()} onClick={() => perform(() => assign({eventId:event._id,userId:userId as Id<"users">,role}))}>Assign staff</Button><p className="text-sm">Staff access only this event at /staff/events. Managers can undo check-in, export rosters, resolve incidents, and request refunds.</p></div>{error && <p role="alert" className="text-red-700">{error}</p>}</details>;
}
