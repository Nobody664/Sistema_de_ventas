# Diagramas — Estructura de plataforma (SUPER_ADMIN) + Distribuidores

> Hermano de `docs/plan/plan-estructura-superadmin-distribuidores.md`.  
> Diagramas Mermaid (se renderizan en GitHub / VS Code con extensión Mermaid).

---

## D1 — Arquitectura de dominios (3 capas separadas)

```mermaid
flowchart TB
    subgraph USER["Usuario con sesión (cookie access_token)"]
        U[Usuario]
    end

    subgraph GLOBAL["DOMINIO PLATAFORMA — sin tenant"]
        direction TB
        PG["PlatformGuard<br/>globalRole ∈ {SUPER_ADMIN, SUPPORT_ADMIN}"]
        PM["Módulo NestJS platform/*"]
        PS[("Datos de plataforma<br/>Plan · PaymentSetting · CheckoutRequest<br/>PlatformSetting · PlatformAuditLog")]
        PG --> PM --> PS
    end

    subgraph TENANT["DOMINIO EMPRESA (tenant)"]
        direction TB
        TG["TenantGuard<br/>requiere companyId"]
        RG["RolesGuard + PermissionsGuard<br/>MembershipRole + tenant:*"]
        TM["Módulos: products · sales · inventory<br/>customers · employees · reports …"]
        TD[("Datos por empresa<br/>Company · Membership · Employee<br/>Product · Sale · InventoryMovement · Kardex")]
        TG --> RG --> TM --> TD
    end

    subgraph DIST["DOMINIO DISTRIBUIDORES (tenant, nuevo)"]
        direction TB
        DG["TenantGuard + @Roles<br/>(COMPANY_ADMIN, MANAGER)"]
        DM["Módulo NestJS distributors/*"]
        DD[("Distributor · DistributorDelivery<br/>DistributorBalance<br/>+ distributorId en Sale/InventoryMovement")]
        DG --> DM --> DD
        DM -.->|"usan los mismos<br/>inventory/sales"| TM
    end

    U -->|"GET /platform/*"| PG
    U -->|"GET /api/*"| TG
    U -->|"GET /api/distributors/*"| DG

    classDef plat fill:#ede9fe,stroke:#7c3aed,color:#1e1b4b
    classDef ten fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef dis fill:#fef9c3,stroke:#ca8a04,color:#422006
    class PS,PG,PM plat
    class TD,TG,RG,TM ten
    class DD,DG,DM dis
```

---

## D2 — Modelo ER (nuevas tablas y relaciones clave)

```mermaid
erDiagram
    User ||--o{ Membership : "globalRole + membership.role"
    Company ||--|{ Membership : tiene
    Company ||--o{ Employee : tiene
    User ||--o| Employee : "opcional"
    Company ||--o{ Product : tiene
    Company ||--o{ InventoryMovement : tiene
    Company ||--o{ Sale : tiene

    User ||--o| Distributor : "userId opcional (acceso)"
    Company ||--o{ Distributor : tiene
    Distributor ||--o{ DistributorDelivery : despachos
    Distributor ||--o{ DistributorBalance : saldo
    Distributor ||--o{ Sale : "channel = DISTRIBUTOR"
    Distributor ||--o{ InventoryMovement : "TRANSFER / RETURN"

    MembershipRole {
        string COMPANY_ADMIN
        string MANAGER
        string CASHIER
        string VIEWER
        string DISTRIBUTOR "NUEVO"
    }
    GlobalRole {
        string SUPER_ADMIN "plataforma"
        string SUPPORT_ADMIN "soporte"
        string ADMIN "DEPRECADO"
        string USER
    }

    Distributor {
        string id PK
        string companyId FK
        string code "único por empresa"
        string name
        string status "ACTIVE|SUSPENDED|BLOCKED"
        string type "INDIVIDUAL|COMPANY"
        decimal commissionRate
        string userId FK "nullable"
    }
    DistributorDelivery {
        string id PK
        string distributorId FK
        string status
    }
    DistributorBalance {
        string id PK
        string distributorId FK
        int qtyConsigned
        int qtyReturned
        int qtySold
        decimal debt
    }
```

> `InventoryMovement.distributorId` y `Sale.distributorId/channel` son columnas **nullable** agregadas a tablas existentes: cero duplicación de fuentes de verdad de stock.

---

## D3 — Flujo de autenticación y autorización (sequence)

```mermaid
sequenceDiagram
    participant B as Browser
    participant P as proxy.ts (Next 16)
    participant L as Layout (platform/dashboard)
    participant API as Backend NestJS
    participant AU as AuthGuard
    participant GU as PlatformGuard / TenantGuard
    participant PG as PermissionsGuard

    B->>P: GET /platform/companies (o /dashboard/...)
    P->>P: ¿cookie access_token?
    alt sin cookie
        P-->>B: redirect /sign-in
    end
    alt ruta /platform/* y globalRole no es SUPER_ADMIN/SUPPORT_ADMIN
        P-->>B: redirect /forbidden
    else ruta tenant y sin MembershipRole
        P-->>B: redirect /forbidden
    end
    P->>L: pasa al layout
    L->>L: getServerSession() + guard temprano (Server Component)
    L->>API: fetch /platform/companies (cookie httpOnly)
    API->>AU: verifica JWT, setea req.user {globalRole, memberships}
    AU->>GU: PlatformGuard (exige globalRole, NIEGA tenant) ó TenantGuard (exige companyId)
    GU->>PG: valida permisos del rol
    alt violación
        PG-->>B: 403 → serverApiFetch lanza error visible (no null silencioso)
    else ok
        PG-->>B: 200 + datos
    end
```

---

## D4 — Enrutado por rol en frontend (proxy + guards por página)

```mermaid
flowchart TD
    A[Request de ruta] --> B{¿Hay cookie access_token?}
    B -- No --> S[/sign-in/]
    B -- Sí --> C{Prefijo de la ruta}

    C -- "/platform/*" --> D{globalRole ∈ SUPER_ADMIN, SUPPORT_ADMIN?}
    D -- No --> X[/forbidden/]
    D -- Sí --> E["(platform)/layout.tsx<br/>data-platform · sidebar propio"]

    C -- rutas tenant --> F{¿Tiene MembershipRole?}
    F -- No --> X
    F -- Sí --> G{Estado de companyStatus}
    G -- INACTIVE --> PE[/plan-expired/]
    G -- SUSPENDED --> AS[/account-suspended/]
    G -- ACTIVE --> H["(dashboard)/layout.tsx<br/>data-app · sidebar tenant"]

    E --> E1["Secciones: overview · companies<br/>subscribers · upgrade-requests · plans<br/>templates · settings pago global · audit · admins"]
    H --> H1["Secciones: dashboard · inventory · products<br/>categories · sales · customers · employees<br/>reports · payments · subscription · notifications<br/>distributors"]

    style X fill:#fee2e2,stroke:#dc2626
    style E fill:#ede9fe,stroke:#7c3aed
    style H fill:#dcfce7,stroke:#16a34a
```

---

## D5 — Ciclo de vida del distribuidor y flujo de inventario

```mermaid
flowchart TD
    N[COMPANY_ADMIN crea distribuidor] --> A[Distributor ACTIVE<br/>código único por empresa]
    A --> D["Distribuidor con cuenta propia<br/>MembershipRole = DISTRIBUTOR"]

    D --> T1["TRANSFER: envío de mercadería<br/>stock almacén → consignación<br/>(InventoryMovement.type = TRANSFER)"]
    T1 --> B[DistributorBalance: qtyConsigned ++]

    B --> S["Venta reportada por el distribuidor<br/>Sale.channel = DISTRIBUTOR<br/>+ InventoryMovement.type = OUT"]
    S --> K[Kardex: costo de venta aplicado<br/>DistributorBalance: qtySold ++]

    S --> R["Devolución no vendida<br/>InventoryMovement.type = RETURN"]
    R --> K2[Almacén recupera disponibilidad<br/>DistributorBalance: qtyReturned ++]

    B --> ST["Liquidación / comisión<br/>debt y commissionRate calculados<br/>DistributorSettlementService"]
    ST --> Pago[Pago registrado por la empresa]

    A --> SB{¿Incumple / suspendido?}
    SB -- Sí --> SUS[DistributorStatus = SUSPENDED<br/>bloquea TRANSFER y venta]
    SB -- No --> A

    subgraph TX["Todo dentro de $transaction (Prisma 7)"]
        T1
        S
        R
    end

    style SUS fill:#fee2e2,stroke:#dc2626
    style TX fill:#f0fdf4,stroke:#16a34a
```

---

## D6 — Namespaces de rutas backend (separación observable en red)

```mermaid
flowchart LR
    subgraph PUB["Público @Public()"]
        H0["GET /api/health/ready"]
        H1["POST /api/auth/login"]
        H2["GET /api/plans"]
    end

    subgraph PLAT["Prefijo /platform — PlatformGuard"]
        P1["/platform/companies"]
        P2["/platform/plans"]
        P3["/platform/settings/payment"]
        P4["/platform/metrics"]
        P5["/platform/audit"]
        P6["/platform/admins"]
    end

    subgraph TEN["Prefijo /api — TenantGuard + Roles/Permissions"]
        T1["/api/products · /api/sales · /api/inventory"]
        T2["/api/employees · /api/customers · /api/reports"]
        T3["/api/subscriptions · /api/notifications"]
        T4["/api/distributors/*"]
    end

    subgraph DEP["Aliases deprecados (redirect/compatibilidad temporal)"]
        D1["/api/payment-settings → /platform/settings/payment"]
        D2["/api/audit/global → /platform/audit"]
    end

    style PLAT fill:#ede9fe,stroke:#7c3aed
    style TEN fill:#dcfce7,stroke:#16a34a
    style DEP fill:#f1f5f9,stroke:#64748b,stroke-dasharray: 5 5
```

---

## D7 — Roadmap de ejecución (fases)

```mermaid
flowchart LR
    F0["Fase 0<br/>Fundación<br/>PlatformGuard · (platform)<br/>sidebar dividido · proxy por rol"] --> F1
    F1["Fase 1<br/>Datos Prisma<br/>Distributor · enums<br/>MembershipRole.DISTRIBUTOR<br/>PlatformSetting · migración"] --> F2
    F2["Fase 2<br/>Backend platform/*<br/>companies · plans · settings<br/>metrics · audit · admins"] --> F3
    F3["Fase 3<br/>Backend distributors/*<br/>CRUD · TRANSFER/RETURN<br/>ventas · liquidación"] --> F4
    F4["Fase 4<br/>Frontend<br/>páginas (platform)<br/>distributors (dashboard)<br/>canal en POS + reportes"] --> F5
    F5["Fase 5<br/>Endurecimiento<br/>tests e2e 403 cross-domain<br/>CI de permisos<br/>docs"]

    style F0 fill:#ede9fe,stroke:#7c3aed
    style F5 fill:#dcfce7,stroke:#16a34a
```

---

## D8 — Mapa de roles → dominio → UI (tabla lógica)

```mermaid
flowchart TD
    subgraph GR["globalRole (identidad)"]
        SA[SUPER_ADMIN]
        SS[SUPPORT_ADMIN]
        U[USER]
    end

    subgraph MR["MembershipRole (tenant)"]
        CA[COMPANY_ADMIN]
        MA[MANAGER]
        CA2[CASHIER]
        VW[VIEWER]
        DS[DISTRIBUTOR]
    end

    SA -->|plataforma| UI1["/(platform)<br/>empresas · planes · pagos globales<br/>auditoría · admins · métricas"]
    SS -->|plataforma solo lectura| UI1
    CA -->|empresa| UI2["/(dashboard)<br/>todo + empleados · suscripción<br/>config de empresa"]
    MA -->|empresa| UI3["/(dashboard)<br/>sin: crear empleados<br/>sin: métodos de pago globales"]
    CA2 -->|empresa| UI4["/(dashboard)<br/>POS · productos · clientes<br/>sin Productos? (sin VIEWER) · sin empleados"]
    VW -->|empresa| UI5["/(dashboard)<br/>solo lectura · sin Productos (hoy)"]
    DS -->|empresa| UI6["/(dashboard)/distributors<br/>solo sus despachos · ventas · saldo"]

    style UI1 fill:#ede9fe,stroke:#7c3aed
    style UI6 fill:#fef9c3,stroke:#ca8a04
```
