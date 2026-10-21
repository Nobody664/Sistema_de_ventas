export type CreditNoteType = "CREDIT" | "DEBIT";
export type CreditNoteReason = "RETURN" | "DISCOUNT" | "CORRECTION" | "OTHER";
export type CreditNoteStatus = "ISSUED" | "APPLIED" | "CANCELLED";

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreditNote {
  id: string;
  companyId: string;
  saleId: string;
  noteNumber: string;
  type: CreditNoteType;
  reason: CreditNoteReason;
  status: CreditNoteStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  description: string | null;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  sale?: {
    id: string;
    saleNumber: string;
    totalAmount: number;
  };
  createdBy?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  items: CreditNoteItem[];
}

export interface CreditNotesResponse {
  data: CreditNote[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
