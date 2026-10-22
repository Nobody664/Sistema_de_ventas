export type DistributorType = "INDIVIDUAL" | "COMPANY";

export type DistributorStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";

export interface DistributorBalance {
  id: string;
  distributorId: string;
  startingQuantity: string;
  returnedQuantity: string;
  soldQuantity: string;
  balanceQuantity: string;
  debtAmount: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Distributor {
  id: string;
  companyId: string;
  userId: string | null;
  code: string;
  name: string;
  documentType: string | null;
  documentValue: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: DistributorType;
  status: DistributorStatus;
  commissionRate: string | null;
  priceListId: string | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  balance: DistributorBalance | null;
}

export interface DistributorSaleItem {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  product?: { name: string; sku: string | null } | null;
}

export interface DistributorSale {
  id: string;
  saleNumber: string;
  channel: string;
  paymentMethod: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string | null;
  totalAmount: string;
  createdAt: string;
  items: DistributorSaleItem[];
}

export interface DistributorDeliveryItem {
  productId: string;
  quantity: number;
}

export interface DistributorDelivery {
  id: string;
  deliveryNumber: string;
  status: "PENDING" | "DELIVERED" | "CANCELLED";
  deliveryDate: string;
  amount: string | null;
  items: DistributorDeliveryItem[] | null;
  notes: string | null;
  createdAt: string;
}

export interface DistributorProductOption {
  id: string;
  name: string;
  sku: string | null;
  baseUnit: string;
  stockQuantity: string;
  salePrice: string;
}
