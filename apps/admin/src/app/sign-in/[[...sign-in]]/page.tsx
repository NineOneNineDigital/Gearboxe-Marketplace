import { AuthShell } from "@/components/ui/auth-shell";
import { AdminSignInForm } from "../../../auth-form";

export default function SignInPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AuthShell area="admin">
        <div className="w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to your Gearboxe administration account</p>
          </div>
          <AdminSignInForm />
        </div>
      </AuthShell>
    </div>
  );
}
