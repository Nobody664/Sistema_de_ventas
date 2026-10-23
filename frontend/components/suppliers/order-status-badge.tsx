import type { SupplierOrderStatus } from "@/types/suppliers";
import { ORDER_STATUS_LABELS } from "@/types/suppliers";

const colors: Record<SupplierOrderStatus, string> = {
  DRAFT: "bg-foreground/10 text-foreground/60",
  SENT: "bg-blue-500/15 text-blue-600",
  CONFIRMED: "bg-emerald-500/15 text-emerald-600",
  CANCELLED: "bg-red-500/15 text-red-600",
};

export function OrderStatusBadge({ status }: { status: SupplierOrderStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
