import { SetMetadata } from "@nestjs/common";
import { PlanModuleKey } from "../plan-capabilities.constants";

export const REQUIRE_MODULE_KEY = "requireModule";

export const RequireModule = (...modules: PlanModuleKey[]) =>
  SetMetadata(REQUIRE_MODULE_KEY, modules);
