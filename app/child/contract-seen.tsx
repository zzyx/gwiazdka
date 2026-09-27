"use client";

import { useEffect } from "react";
import { CONTRACT_SEEN_COOKIE } from "@/lib/contract-seen";

// Remembers on this device that the child has seen this Contract's page.
export function MarkContractSeen({ contractId }: { contractId: string }) {
  useEffect(() => {
    document.cookie = `${CONTRACT_SEEN_COOKIE}=${contractId}; path=/; max-age=31536000; samesite=lax`;
  }, [contractId]);
  return null;
}
