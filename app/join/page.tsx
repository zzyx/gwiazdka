import type { Viewport } from "next";
import { SignedOut, signedOutViewport } from "./signed-out";

export async function generateViewport(): Promise<Viewport> {
  return signedOutViewport();
}

export default function JoinPage() {
  return <SignedOut page="join" />;
}
