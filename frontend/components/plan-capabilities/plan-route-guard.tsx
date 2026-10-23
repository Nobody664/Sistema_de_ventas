"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  getRouteRequirement,
  missingRequirementLabel,
  satisfiesRequirement,
} from "@/lib/plan-capabilities";
import { usePlanCapabilities } from "./plan-capabilities-provider";
import { UpgradeRequired } from "./upgrade-required";

interface PlanRouteGuardProps {
  roles: string[];
  children: ReactNode;
}

export function PlanRouteGuard({ roles, children }: PlanRouteGuardProps) {
  const pathname = usePathname();
  const { capabilities } = usePlanCapabilities();

  const requirement = getRouteRequirement(pathname);

  if (satisfiesRequirement(capabilities, requirement)) {
    return <>{children}</>;
  }

  const canUpgrade = roles.includes("COMPANY_ADMIN");

  return (
    <UpgradeRequired
      featureLabel={missingRequirementLabel(requirement)}
      canUpgrade={canUpgrade}
    />
  );
}
