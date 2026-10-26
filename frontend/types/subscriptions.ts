export interface PendingPlanUpgrade {
  id: string;
  status: string;
  plan: { code: string; name: string };
}
