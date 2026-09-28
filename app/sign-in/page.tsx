import Link from "next/link";
import { figtree } from "../parent/font";
import { SignInForm } from "./sign-in-form";

// In the parent's look: only parents sign in with a password.
export default function SignInPage() {
  return (
    <main
      className={`${figtree.className} flex flex-1 flex-col items-center justify-center gap-5 bg-[#F6F7F9] p-4 text-[#1F2430]`}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Parent sign-in</h1>
        <SignInForm />
      </div>
      <Link href="/" className="text-sm text-[#6B7280] underline">
        Back
      </Link>
    </main>
  );
}
