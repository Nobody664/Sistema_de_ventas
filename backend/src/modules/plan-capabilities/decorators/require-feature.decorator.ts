import { SetMetadata } from "@nestjs/common";
import { PlanFeatureKey } from "../plan-capabilities.constants";

export const REQUIRE_FEATURE_KEY = "requireFeature";

export const RequireFeature = (...features: PlanFeatureKey[]) =>
  SetMetadata(REQUIRE_FEATURE_KEY, features);
