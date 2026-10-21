export type MetricsGranularity = "day" | "week" | "month";

export interface MetricsTrendPoint {
  bucket: string;
  sales: number;
  revenue: number;
}

export interface MetricsSummary {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalUnits: number;
}

export interface MetricsComparison {
  revenueChange: number;
  salesChange: number;
  averageTicketChange: number;
}

export interface RotationPoint {
  productId: string;
  name: string;
  quantitySold: number;
  averageStock: number;
  rotation: number;
}

export interface RotationMetrics {
  globalRotation: number;
  averageStockValue: number;
  coefficient: number;
  products: RotationPoint[];
}

export interface DashboardMetrics {
  period: {
    days: number;
    granularity: MetricsGranularity;
    from: string;
    to: string;
  };
  summary: MetricsSummary;
  previous: MetricsSummary;
  comparison: MetricsComparison;
  trend: MetricsTrendPoint[];
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  rotation: RotationMetrics;
}
