export type SupportTicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type SupportTicketSource = "CHAT" | "FORM" | "EMAIL" | "SYSTEM";

export interface SupportUserRef {
  id: string;
  email: string;
  fullName: string;
}

export interface SupportTicket {
  id: string;
  companyId: string;
  requesterId: string;
  assignedToId: string | null;
  conversationId: string | null;
  title: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  source: SupportTicketSource;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: SupportUserRef;
  assignedTo?: SupportUserRef | null;
  company?: { id: string; name: string };
}

export interface SupportTicketComment {
  id: string;
  ticketId: string;
  authorId: string | null;
  isInternal: boolean;
  content: string;
  createdAt: string;
  author?: SupportUserRef | null;
}

export interface SupportTicketStatusHistory {
  id: string;
  ticketId: string;
  fromStatus: SupportTicketStatus | null;
  toStatus: SupportTicketStatus;
  changedById: string | null;
  reason: string | null;
  createdAt: string;
  changedBy?: SupportUserRef | null;
}

export interface SupportTicketDetail extends SupportTicket {
  comments: SupportTicketComment[];
  history: SupportTicketStatusHistory[];
}

export interface PaginatedSupportTickets {
  data: SupportTicket[];
  total: number;
  page: number;
  limit: number;
}

export interface SupportTicketMetrics {
  openTickets: number;
  byPriority: Record<string, number>;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
}

export type SupportConversationStatus = "OPEN" | "PENDING" | "CLOSED";

export interface SupportConversationParticipantRef {
  id: string;
  userId: string;
  role: "REQUESTER" | "AGENT" | "OBSERVER";
  lastReadAt: string | null;
  user: SupportUserRef;
}

export interface SupportConversation {
  id: string;
  companyId: string | null;
  status: SupportConversationStatus;
  createdById: string;
  assignedToId: string | null;
  subject: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: SupportUserRef;
  assignedTo?: SupportUserRef | null;
  company?: { id: string; name: string } | null;
  participants?: SupportConversationParticipantRef[];
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: "TEXT" | "SYSTEM" | "FAQ_SUGGESTION" | "AUTO_REPLY";
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  sender?: SupportUserRef | null;
}

export interface PaginatedSupportConversations {
  data: SupportConversation[];
  total: number;
  page: number;
  limit: number;
}

export interface SupportFaq {
  id: string;
  scope: "GLOBAL" | "TENANT";
  companyId: string | null;
  question: string;
  answer: string;
  keywords: string[];
  isPublished: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  sortOrder: number;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSupportFaqs {
  data: SupportFaq[];
  total: number;
  page: number;
  limit: number;
}

export const TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  PENDING_CUSTOMER: "Esperando cliente",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

export const TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};
