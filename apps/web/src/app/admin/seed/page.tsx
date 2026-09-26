"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import {
  Calendar,
  Car,
  Database,
  Loader2,
  MessageSquare,
  Users,
} from "lucide-react";
import { useState } from "react";

export default function SeedPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);
  const seedDatabase = useMutation(api.seed.seedDatabase);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const result = await seedDatabase();
      setSeedResult(result);
    } catch (error) {
      console.error("Error seeding database:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button asChild variant="ghost" size="sm">
            <a href="/admin">← Back to Admin</a>
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Database Seeding
        </h1>
        <p className="text-gray-600">
          Populate the database with fake data for testing and development.
        </p>
      </div>

      {/* Seed Button */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Seed Database
          </CardTitle>
          <CardDescription>
            This will add fake users, vehicles, events, and other test data to
            your database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSeed}
            disabled={isSeeding}
            className="text-white"
          >
            {isSeeding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding Database...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Seed Database
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {seedResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Seeding Complete!</CardTitle>
            <CardDescription>
              Successfully added fake data to the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-600">
                  {seedResult.users}
                </div>
                <div className="text-sm text-gray-600">Users</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Car className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">
                  {seedResult.vehicles}
                </div>
                <div className="text-sm text-gray-600">Vehicles</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">
                  {seedResult.events}
                </div>
                <div className="text-sm text-gray-600">Events</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold text-orange-600">
                  {seedResult.messages}
                </div>
                <div className="text-sm text-gray-600">Messages</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">What was added:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>
                  • {seedResult.users} fake users (sellers, buyers, admin)
                </li>
                <li>• {seedResult.cities} cities for events</li>
                <li>• {seedResult.vehicles} vehicles with realistic data</li>
                <li>• {seedResult.events} upcoming events</li>
                <li>• {seedResult.registrations} event registrations</li>
                <li>• {seedResult.messages} sample messages</li>
                <li>• {seedResult.favorites} favorited vehicles</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Data Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Test Data Overview</CardTitle>
          <CardDescription>
            Here's what the seed script will add to your database:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Users</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 3 Sellers: John Smith, Sarah Johnson, Mike Davis</li>
                <li>• 2 Buyers: Emily Brown, David Wilson</li>
                <li>• 1 Admin: Admin User</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Vehicles</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• BMW M3 Competition Package (2019) - $65,000</li>
                <li>• Tesla Model S Performance (2020) - $85,000</li>
                <li>• Porsche 911 Carrera S (2018) - $95,000</li>
                <li>• Ford Mustang GT Premium (2021) - $45,000</li>
                <li>• Audi RS6 Avant (2017) - $75,000</li>
                <li>• Mercedes-AMG C63 S (2019) - $68,000</li>
                <li>• Lamborghini Huracán EVO (2020) - $220,000</li>
                <li>• McLaren 570S (2016) - $180,000</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Events</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• San Francisco Classic Car Show</li>
                <li>• LA Supercar Sunday</li>
                <li>• Pacific Northwest Car Meet</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
