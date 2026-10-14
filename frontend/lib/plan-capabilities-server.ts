import { serverApiFetch } from './server-api';
import type { PlanCapabilities } from './plan-capabilities';

export async function fetchPlanCapabilities(accessToken?: string): Promise<PlanCapabilities | null> {
  return serverApiFetch<PlanCapabilities>('/plan-capabilities/me', accessToken);
}
