export interface DashboardOverview {
  company: { name: string; currency: string } | null;
  salesScope: "COMPANY" | "SELLER";
  salesToday: number;
  revenueToday: number;
  inventoryMetrics: { lowStockCount: number; outOfStockCount: number };
  dataCoverage?: {
    inventory: { returned: number; total: number; truncated: boolean };
  };
}
