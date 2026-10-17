import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <main className="sign-in"><SignIn routing="path" path="/sign-in" /></main>;
}
