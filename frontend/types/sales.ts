export interface SalesMetrics {
  salesScope: "COMPANY" | "SELLER";
  salesToday: number;
  revenueToday: number;
  salesAnalytics: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
  };
}
