import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";

export function useCurrentUser() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);

  // If Convex is still loading, show loading
  if (isLoading) {
    return {
      isLoading: true,
      isAuthenticated: false,
      user: null,
    };
  }

  // If not authenticated with Convex, user is null
  if (!isAuthenticated) {
    return {
      isLoading: false,
      isAuthenticated: false,
      user: null,
    };
  }

  // If authenticated but user data is still loading, show loading
  if (user === undefined) {
    return {
      isLoading: true,
      isAuthenticated: false,
      user: null,
    };
  }

  // If authenticated and user data is loaded (even if null), return the state
  return {
    isLoading: false,
    isAuthenticated: user !== null,
    user,
  };
}
