import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-sky-100 p-8 text-center">
      <h1 className="text-2xl font-bold text-sky-900">Parent sign-in</h1>
      <SignInForm />
    </main>
  );
}
