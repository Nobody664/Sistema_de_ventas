# Modelo de Datos (Prisma / PostgreSQL)

Fuente: `backend/prisma/schema.prisma`. `relationMode = "foreignKeys"` (FKs reales).
IDs `cuid()`. Nombres de tabla en `snake_case` (mapeados con `@@map`).

## Enums

| Enum | Valores |
|------|---------|
| `CompanyStatus` | `ACTIVE`, `SUSPENDED`, `TRIAL`, `PAST_DUE`, `INACTIVE` |
| `BillingCycle` | `MONTHLY`, `YEARLY` |
| `SubscriptionStatus` | `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED` |
| `PaymentStatus` | `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `CANCELED` |
| `PaymentProvider` | `STRIPE`, `MERCADOPAGO`, `PAYPAL`, `CASH`, `CARD`, `TRANSFER`, `YAPE`, `PLIN` |
| `GlobalRole` | `SUPER_ADMIN`, `SUPPORT_ADMIN`, `ADMIN`, `USER` |
| `MembershipRole` | `COMPANY_ADMIN`, `MANAGER`, `CASHIER`, `VIEWER`, `DISTRIBUTOR` |
| `DistributorType` | `INDIVIDUAL`, `COMPANY` |
| `DistributorStatus` | `ACTIVE`, `SUSPENDED`, `BLOCKED` |
| `SaleChannel` | `POS`, `DISTRIBUTOR`, `ONLINE` |
| `SaleStatus` | `COMPLETED`, `CANCELLED`, `REFUNDED`, `PENDING` |
| `NotificationType` | `SALE`, `PAYMENT`, `INVENTORY`, `SUBSCRIPTION`, `SYSTEM`, `PLAN_UPGRADED`, `PLAN_UPGRADE_REQUEST`, `SUBSCRIPTION_APPROVED`, `SUBSCRIPTION_REJECTED`, `SUBSCRIPTION_PENDING`, `LOW_STOCK`, `PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `PAYMENT_PROOF_PENDING`, `NEW_COMPANY_REGISTRATION`, `CHECKOUT_REQUEST_PENDING`, `ACCOUNT_ACTIVATED`, `ACCOUNT_APPROVED`, `TRIAL_EXPIRING_SOON`, `TRIAL_EXPIRED`, `NEW_SALE`, `NEW_CUSTOMER`, `SALE_COMPLETED`, `SALE_RETURNED`, `GENERAL` |
| `NotificationChannel` | `EMAIL`, `IN_APP`, `SMS`, `WHATSAPP` |
| `PlanUpgradeStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `CheckoutRequestStatus` | `DRAFT`, `SUBMITTED`, `REVIEWING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `AuditAction` | `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `EXPORT` |
| `InventoryMovementType` | `IN`, `OUT`, `ADJUSTMENT`, `RETURN`, `LOSS`, `TRANSFER` |
| `InventoryCostMethod` | `FIFO`, `WEIGHTED_AVERAGE` |
| `UnitOfMeasure` | `UNIT`, `KG`, `LT`, `MT` |
| `RefreshTokenType` | `SESSION`, `RESET` |
| `ProofStatus` | `PENDING`, `APPROVED`, `REJECTED` |

## Modelos por dominio

### Identidad y tenancy

- **`User`** (`users`): `email` (único), `passwordHash` (argon2), `fullName`, `globalRole`
  (def. `USER`), `isActive`. Relaciona con `memberships`, `employee`, `notifications`,
  `auditLogs`, `refreshTokens`, `distributor`.
- **`Company`** (`companies`): `name`, `slug` (único), datos fiscales (`legalName`, `taxId`,
  `address`, `email`, `phone`), `timezone` (def. `America/Lima`), `currency` (def. `PEN`),
  `status` (def. `TRIAL`), `inventoryCostMethod` (def. `WEIGHTED_AVERAGE`), `trialEndsAt`,
  `profileComplete`, `profileCompletedAt`. Es el **tenant** raíz.
- **`Membership`** (`memberships`): vincula `User`↔`Company` con `role` (def. `CASHIER`),
  `isActive`. Único `(userId, companyId)`. Un usuario puede pertenecer a varias empresas.

### Suscripción y facturación

- **`Plan`** (`plans`): `code` (único), `name`, `priceMonthly/Yearly`, `billingCycle`, `maxUsers`,
  `maxProducts`, `features` (Json), `modules` (Json), `permissions` (Json), `apiEnabled`,
  `apiSearchDniEnabled`, `apiQuota`, `isActive`.
- **`Subscription`** (`subscriptions`): `companyId` (único → 1 suscripción por empresa), `planId`,
  `status` (def. `TRIALING`), `provider` (def. `CASH`), `billingCycle`, `startDate`, `endDate`,
  `autoRenew`, `providerSubscriptionId`.
- **`Payment`** (`payments`): pago asociado a `subscriptionId`; `amount`, `status`, `provider`,
  `providerPaymentId` (único), `currency`, `paidAt`, `transactionId` (único), `providerPayload`.
- **`PaymentProof`** (`payment_proofs`): comprobante (`imageBase64`, `amount`, `paymentDate`) con
  `status` (`ProofStatus`), revisión (`reviewedBy/At`, `notes`).
- **`CheckoutRequest`** (`checkout_requests`): solicitud de alta/upgrade con datos de empresa y
  usuario (`fullName`, `email`, `passwordHash`, `taxId`, ...), `planId`, `provider`, `amount`,
  `status` (`CheckoutRequestStatus`), `proofImageBase64`, `idempotencyKey` (único), y enlaces
  resultantes `userId` / `subscriptionId`.
- **`PlanUpgradeRequest`** (`plan_upgrade_requests`): solicitud de cambio de plan; `currentPlanId`,
  `planId`, `provider`, `amount`, `status` (`PlanUpgradeStatus`), `proofImageBase64`,
  `paymentDate`, `submittedAt`, `reviewedBy/At/reviewNotes`, `idempotencyKey` (único).
- **`ApiUsage`** (`api_usage`): consumo de API por `(companyId, period)` con `count`.
- **`PaymentSetting`** (`payment_settings`): configuración de pasarela por `provider` (único):
  `config` (Json), `qrImageBase64`, `accountNumber`, `accountName`, `instructions`, flags.
- **`PlatformSetting`** (`platform_settings`): par `key`/`value` (Json) + `description`,
  `updatedById`.

### Catálogo

- **`Category`** (`categories`): `companyId`, `name`, `slug`, `description`, soft-delete `deletedAt`.
  Único `(companyId, slug)`.
- **`Product`** (`products`): `companyId`, `categoryId?`, `name`, `sku?`, `description`,
  `salePrice`, `costPrice?`, `baseUnit` (`UnitOfMeasure`), `stockQuantity` (def. 0),
  `minStock` (def. 5), `reorderPoint?`, `safetyStock?`, `leadTimeDays?`, `lastSoldAt?`, `isActive`,
  `imageUrl?`, `barcode?`, soft-delete `deletedAt`. Únicos `(companyId, sku)` y `(companyId, barcode)`.
- **`ProductPresentation`** (`product_presentations`): presentaciones de un producto (`name`,
  `factor` de conversión a unidad base, `price?`, `barcode?`, `isActive`). Único `(productId, name)`
  y `(companyId, barcode)`.

### Inventario

- **`Branch`** (`branches`): sucursal (`name`, `address`, `isActive`) del tenant.
- **`StockEntry`** (`stock_entries`): cabecera de ingreso de mercadería (`branchId?`, `reference`,
  `notes`). **`StockEntryItem`** (`stock_entry_items`): `productId`, `presentationId?`, `quantity`,
  `baseQuantity`, `unitCost`.
- **`ProductBatch`** (`product_batches`): lote (`batchNumber`, `quantityReceived`,
  `quantityAvailable`, `purchasePrice`, `expirationDate?`, `branchId?`).
- **`InventoryMovement`** (`inventory_movements`): movimiento (`type`, `quantity`, `unitCost?`,
  `totalCost?`, `reference`, `reason`, `notes`, `branchId?`, `presentationId?`, `distributorId?`).
- **`InventoryKardex`** (`inventory_kardex`): asiento valorizado (`movementType`, entradas
  `qtyIn/unitCostIn/totalCostIn`, salidas `qtyOut/unitCostOut/totalCostOut`, saldos
  `balanceQty/balanceUnitCost/balanceTotalCost`).

### Ventas

- **`Sale`** (`sales`): `companyId`, `customerId?`, `employeeId?`, `distributorId?`, `couponId?`,
  `channel` (def. `POS`), `saleNumber` (único por empresa), `status` (def. `COMPLETED`), `subtotal`,
  `taxAmount`, `discountAmount?`, `totalAmount`, `paymentMethod`, `paidAmount`, `changeAmount`,
  `notes`.
- **`SaleItem`** (`sale_items`): `saleId`, `productId`, `presentationId?`, `quantity`, `unitPrice`,
  `totalPrice`. Único `(saleId, productId)`.
- **`DiscountCoupon`** (`discount_coupons`): `companyId`, `code` (únicos), `description?`,
  `type` (`DiscountType`: `PERCENTAGE`/`FIXED`), `value`, `maxUses?` (cupo), `usedCount` (def. 0),
  `minPurchase?`, `startsAt?`, `expiresAt?`, `isActive` (def. true). Único `(companyId, code)`,
  índice `(companyId, isActive)`.
- **`Customer`** (`customers`): `firstName`, `lastName?`, `email?`, `phone?`, `documentType?`,
  `documentValue?`, `address?`, `notes?`, `paidAt?`, soft-delete `deletedAt`. Únicos
  `(companyId, email)` y `(companyId, documentValue)`.
- **`Employee`** (`employees`): `userId?` (único, vínculo opcional a `User`), `firstName`,
  `lastName?`, `email?`, `phone?`, `dni?`, `role` (`MembershipRole`), `isActive`, soft-delete.
  Únicos `(companyId, dni)`.
- **`InvoiceTemplate`** (`invoice_templates`): plantilla de boleta/factura; `companyId?`
  (null = global), `name`, `content` (Text), flags `isGlobal/isDefault/isActive`, y muchos campos
  de configuración (`type`, `headerText`, `logoUrl`, `companyRuc/Address/Phone`, `show*`, `footerText`,
  `taxPercentage`, `customFields`, `fontFamily`, `fontSize`, `paperSize`).

### Distribuidores

- **`Distributor`** (`distributors`): `code` (único por empresa), `name`, datos de contacto,
  `type` (`DistributorType`), `status` (`DistributorStatus`), `commissionRate?`, `priceListId?`,
  `userId?` (único, acceso opcional), soft-delete.
- **`DistributorBalance`** (`distributor_balances`): saldo por distribuidor (único
  `distributorId`): `startingQuantity`, `returnedQuantity`, `soldQuantity`, `balanceQuantity`,
  `debtAmount?`.
- **`DistributorDelivery`** (`distributor_deliveries`): entrega (`deliveryNumber` único por empresa,
  `status` def. `PENDING`, `amount?`, `deliveryDate`, `items` Json, `notes`).

### Notificaciones, auditoría, sesiones

- **`Notification`** (`notifications`): `userId`, `companyId?`, `type`, `channel` (def. `IN_APP`),
  `title`, `message`, `data` (Json), `isRead`, `sentAt?`.
- **`AuditLog`** (`audit_logs`): `companyId`, `userId?`, `action`, `entity`, `entityId`, `changes`
  (Json), `ipAddress`, `userAgent`.
- **`PlatformAuditLog`** (`platform_audit_logs`): igual pero con `actorId` (usuario de plataforma),
  sin `companyId`.
- **`RefreshToken`** (`refresh_tokens`): `userId`, `companyId?`, `tokenHash` (único), `familyId`,
  `type` (`SESSION`/`RESET`), `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`, `replacedBy`.

## Relaciones clave

```
Company 1─* Membership *─1 User
Company 1─* Subscription *─1 Plan
Subscription 1─* Payment / PaymentProof
Company 1─* Product *─1 Category (opcional)
Product 1─* ProductPresentation / ProductBatch / InventoryKardex / InventoryMovement
Company 1─* StockEntry 1─* StockEntryItem *─1 Product
Company 1─* Sale 1─* SaleItem *─1 Product
Sale *─1 DiscountCoupon (opcional)
Sale *─1 Customer / Employee / Distributor (todos opcionales)
Company 1─* DiscountCoupon (código único por empresa)
Company 1─* Distributor 1─1 DistributorBalance, 1─* DistributorDelivery
User 1─* RefreshToken / Notification / AuditLog
Company 1─* Branch / ApiUsage
```

## Índices/unicidad destacables

- `products`: `@@unique([companyId, sku])`, `@@unique([companyId, barcode])`.
- `sales`: `@@unique([companyId, saleNumber])`.
- `discount_coupons`: `@@unique([companyId, code])`, `@@index([companyId, isActive])`.
- `distributors`: `@@unique([companyId, code])`; `distributor_deliveries`: `@@unique([companyId, deliveryNumber])`.
- `customers`: únicos `(companyId, email)` y `(companyId, documentValue)`.
- `entities` con soft-delete (`deletedAt`): `Product`, `Category`, `Customer`, `Employee`, `Distributor`.
