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
  "preparing",
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

  @IsOptional() @IsIn(["PICKUP", "DELIVERY"]) shippingKind?: string;
}

export class StoreAdminCatalogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) limit: number =
    24;
  @IsOptional() @StoreText(0, 80) q?: string;
  @IsOptional() @StoreText(1, 128) categoryId?: string;
  @IsOptional() @IsIn(["published", "hidden"]) publication?: string;
  @IsOptional() @IsIn(["active", "inactive"]) activity?: string;
}

export class StoreAdminAccountsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) limit: number =
    24;
  @IsOptional() @StoreText(0, 80) q?: string;
  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "CLOSED"])
  status?: string;
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
    query.shippingKind ||
    query.cursor ||
    query.limit !== undefined,
  );
}
