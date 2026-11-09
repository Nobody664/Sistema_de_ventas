import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { StoreText } from "../../dto/store-validation";

export const STORE_ADMIN_QUEUES = [
  "review",
  "prepare",
  "pickup",
  "shipping",
] as const;

export const STORE_ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "REVIEW_REQUIRED",
  "COMPLETED",
] as const;

export const STORE_FULFILLMENT_STATES = [
  "UNFULFILLED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type StoreAdminQueue = (typeof STORE_ADMIN_QUEUES)[number];

export class StoreAdminDashboardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class StoreAdminOrdersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;

  @IsOptional()
  @IsIn(STORE_ORDER_STATUSES)
  status?: string;

  @IsOptional() @StoreText(1, 40) paymentStatus?: string;

  @IsOptional()
  @IsIn(STORE_FULFILLMENT_STATES)
  fulfillment?: string;

  @IsOptional()
  @IsIn(STORE_ADMIN_QUEUES)
  queue?: StoreAdminQueue;

  @IsOptional() @StoreText(1, 80) q?: string;
}

export function usesStoreAdminOrderFilters(
  query: StoreAdminOrdersQueryDto,
): boolean {
  return Boolean(
    query.queue ||
    query.status ||
    query.paymentStatus ||
    query.fulfillment ||
    query.q ||
    query.cursor ||
    query.limit !== undefined,
  );
}
