"use client";

import { useState } from "react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { BillingSubscriptionGuard } from "./BillingSubscriptionGuard";
import { OnboardingGuard } from "./OnboardingGuard";

export function ProtectedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [boundaryKey, setBoundaryKey] = useState(0);
  return (
    <ErrorBoundary
      key={boundaryKey}
      onReset={() => setBoundaryKey((k) => k + 1)}
    >
      <BillingSubscriptionGuard>
        <OnboardingGuard>{children}</OnboardingGuard>
      </BillingSubscriptionGuard>
    </ErrorBoundary>
  );
}
