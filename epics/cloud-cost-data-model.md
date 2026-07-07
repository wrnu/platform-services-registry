# Cloud Cost Data Model

Technical companion for the [Cloud Cost Accountability epic](./cloud-cost.md). Defines **data shapes** the Registry expects from the Cloud Service Provider (CSP) layer and how those map to Registry persistence.

Jira story status: [cloud-cost-jira-backlog.md](./cloud-cost-jira-backlog.md).

**Assumption:** CSP integration delivers correct, licence-plate-level consumption data. This document does not specify how CSP collects data from AWS/Azure or how messages are transported.

## Current implementation baseline

| Capability                                | Status                  | Location                                                                                                          |
| ----------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Per-environment monthly budget on product | Implemented             | `PublicCloudProduct.budget` (`dev`, `test`, `prod`, `tools`)                                                      |
| Provider currency (AWS USD, Azure CAD)    | Implemented             | `Provider` enum, `Budget` form, eMOU PDF                                                                          |
| eMOU signing and director review          | Implemented             | `PublicCloudBilling`, tasks `SIGN_PUBLIC_CLOUD_MOU`, `REVIEW_PUBLIC_CLOUD_MOU`                                    |
| Account coding on billing records         | Implemented             | `PublicCloudBilling.accountCoding`                                                                                |
| CSP consumption feed                      | Implemented             | `PUT /api/internal/csp/consumption`, `POST /api/internal/csp/alerts`, `PUT /api/internal/csp/consumption/history` |
| Cloud spend persistence                   | Implemented             | `CloudSpendSnapshot`, `CloudSpendHistory` — `app/services/db/public-cloud-accountability.ts`                      |
| Forecasts and accountability state        | Implemented             | `CloudCostForecast`, `CloudCostAccountabilityState`, `AccountabilityAlert`, `CloudCostQuarterlyReview`            |
| Rules configuration                       | Implemented             | `CloudCostRulesConfig` — admin UI `/admin/public-cloud/cost-rules`                                                |
| Accountability jobs (scheduled)           | Implemented             | `app/services/accountability/jobs.ts`, Airflow `accountability_jobs_*` DAGs                                       |
| Forecast reject                           | Implemented             | Story 1.5 — `rejectForecast()`, `POST .../forecasts/[id]/reject`                                                  |
| Notification audit                        | Implemented             | Story 7.5 — `AccountabilityNotificationLog`, `accountability-notifications.ts`                                    |
| 80% budget warning on request form        | UI text only            | `app/components/form/Budget.tsx` — not enforced; milestones use approved forecast                                 |
| Private cloud cost projection             | Implemented (reference) | `app/services/db/private-cloud-costs.ts`                                                                          |

---

## CSP data contract

All CSP payloads use **licence plate** as the Project Set identifier (matches `PublicCloudProduct.licencePlate`).

### Shared types

```typescript
type Provider = 'AWS' | 'AWS_LZA' | 'AZURE';

type Currency = 'USD' | 'CAD';

/** Calendar month billing period (1-based month). */
type BillingPeriod = {
    year: number; // e.g. 2026
    month: number; // 1–12
};

type AccountBreakdown = {
    /** CSP account or subscription identifier. */
    accountId: string;
    /** Optional human label (Dev, Test, Prod, Tools). */
    environment?: 'dev' | 'test' | 'prod' | 'tools';
    spendToDate: number;
    currency: Currency;
};
```

### `CspConsumptionSnapshot`

Periodic consumption update for one Project Set. CSP should send at least **daily** during the active month; Registry treats `asOf` as the freshness timestamp.

```typescript
type CspConsumptionSnapshot = {
    licencePlate: string;
    provider: Provider;
    currency: Currency;
    billingPeriod: BillingPeriod;

    /** When CSP calculated this snapshot (ISO 8601). */
    asOf: string;

    /** Actual spend accumulated in the billing period as of `asOf`. */
    spendToDate: number;

    /** CSP-projected total for the full billing period. */
    projectedMonthEnd: number;

    /** Approved Registry forecast for this billing period (current month). */
    currentMonthForecast: number;

    /** spendToDate - currentMonthForecast */
    varianceAmount: number;

    /** (spendToDate / currentMonthForecast) * 100 when forecast > 0 */
    variancePercent: number;

    /** (spendToDate / currentMonthForecast) * 100 when forecast > 0 */
    consumptionPercentOfForecast: number;

    /** Calendar position within the billing month. */
    dayOfMonth: number;
    daysInMonth: number;

    /** Optional per-account breakdown. */
    accounts?: AccountBreakdown[];
};
```

**Example**

```json
{
    "licencePlate": "a1b2c3",
    "provider": "AWS",
    "currency": "USD",
    "billingPeriod": { "year": 2026, "month": 6 },
    "asOf": "2026-06-17T19:00:00Z",
    "spendToDate": 1250.0,
    "projectedMonthEnd": 2100.0,
    "currentMonthForecast": 1800.0,
    "varianceAmount": -550.0,
    "variancePercent": -30.56,
    "consumptionPercentOfForecast": 69.44,
    "dayOfMonth": 17,
    "daysInMonth": 30,
    "accounts": [
        { "accountId": "111122223333", "environment": "dev", "spendToDate": 200.0, "currency": "USD" },
        { "accountId": "444455556666", "environment": "prod", "spendToDate": 950.0, "currency": "USD" }
    ]
}
```

**Registry usage:** Upsert into `CloudSpendSnapshot`; drive accountability UI, quarterly 3-month lookback, and variance display.

---

### `CspConsumptionAlert`

Emitted when CSP rule evaluation crosses a threshold. One event per threshold crossing (Registry deduplicates by `licencePlate` + `alertType` + `billingPeriod` + optional `milestonePercent`).

```typescript
type ConsumptionAlertType =
    | 'MILESTONE' // 50%, 80%, 100%, 125%, …
    | 'PACE' // early pace (e.g. 50% by day 10)
    | 'A1'
    | 'A2'
    | 'A3';

type CspConsumptionAlert = {
    licencePlate: string;
    provider: Provider;
    currency: Currency;
    billingPeriod: BillingPeriod;

    /** When the threshold was crossed (ISO 8601). */
    triggeredAt: string;

    alertType: ConsumptionAlertType;

    /** Set when alertType is MILESTONE (e.g. 50, 80, 100, 125). */
    milestonePercent?: number;

    /** Set when alertType is PACE — day of month when pace rule fired. */
    paceDayOfMonth?: number;

    /** Snapshot values at time of alert. */
    spendToDate: number;
    projectedMonthEnd: number;
    currentMonthForecast: number;
    varianceAmount: number;
    variancePercent: number;
    consumptionPercentOfForecast: number;

    /**
     * CSP rule reference for audit (optional).
     * Example: "a2-percent-above-50" or "milestone-80".
     */
    ruleKey?: string;
};
```

**Example — A2 alert**

```json
{
    "licencePlate": "a1b2c3",
    "provider": "AWS",
    "currency": "USD",
    "billingPeriod": { "year": 2026, "month": 6 },
    "triggeredAt": "2026-06-17T19:00:00Z",
    "alertType": "A2",
    "spendToDate": 2800.0,
    "projectedMonthEnd": 3200.0,
    "currentMonthForecast": 1800.0,
    "varianceAmount": 1000.0,
    "variancePercent": 55.56,
    "consumptionPercentOfForecast": 155.56,
    "ruleKey": "a2-percent-above-50"
}
```

**Example — milestone notice**

```json
{
    "licencePlate": "a1b2c3",
    "provider": "AWS",
    "currency": "USD",
    "billingPeriod": { "year": 2026, "month": 6 },
    "triggeredAt": "2026-06-12T08:00:00Z",
    "alertType": "MILESTONE",
    "milestonePercent": 80,
    "spendToDate": 1440.0,
    "projectedMonthEnd": 1900.0,
    "currentMonthForecast": 1800.0,
    "varianceAmount": -240.0,
    "variancePercent": -13.33,
    "consumptionPercentOfForecast": 80.0,
    "ruleKey": "milestone-80"
}
```

**Registry usage:** Create or update `AccountabilityAlert`; trigger CHES notifications per [rules configuration](./cloud-cost-rules-config.md).

---

### `CspConsumptionHistory`

Optional batch payload for **closed billing periods** (quarterly soft QR, 3-month spend review). Typically monthly totals; not required on every sync.

```typescript
type CspMonthlyTotal = {
    billingPeriod: BillingPeriod;
    currency: Currency;
    /** Total actual spend for the closed month. */
    actualTotal: number;
    /** Registry approved forecast for that month, if known at close. */
    forecastTotal?: number;
    varianceAmount?: number;
    variancePercent?: number;
};

type CspConsumptionHistory = {
    licencePlate: string;
    provider: Provider;
    /** Ordered or unordered; Registry sorts by period. */
    months: CspMonthlyTotal[];
};
```

**Example**

```json
{
    "licencePlate": "a1b2c3",
    "provider": "AWS",
    "months": [
        {
            "billingPeriod": { "year": 2026, "month": 3 },
            "currency": "USD",
            "actualTotal": 1650.0,
            "forecastTotal": 1800.0,
            "varianceAmount": -150.0,
            "variancePercent": -8.33
        },
        {
            "billingPeriod": { "year": 2026, "month": 4 },
            "currency": "USD",
            "actualTotal": 1920.0,
            "forecastTotal": 1800.0,
            "varianceAmount": 120.0,
            "variancePercent": 6.67
        },
        {
            "billingPeriod": { "year": 2026, "month": 5 },
            "currency": "USD",
            "actualTotal": 2100.0,
            "forecastTotal": 1800.0,
            "varianceAmount": 300.0,
            "variancePercent": 16.67
        }
    ]
}
```

**Registry usage:** Quarterly review UI (past 3 months spend); historical charts; audit.

---

### Field rules

| Rule                | Detail                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Licence plate       | Required; must match an active `PublicCloudProduct`                                                                                |
| Currency            | `USD` for `AWS` / `AWS_LZA`; `CAD` for `AZURE`                                                                                     |
| Amounts             | Non-negative decimals; two decimal places in storage                                                                               |
| Forecast comparison | `currentMonthForecast` comes from Registry approved forecast for that month; CSP may echo it back in payloads                      |
| Idempotency         | Same `licencePlate` + `billingPeriod` + `asOf` (snapshot) or `alertType` + `milestonePercent` (alert) should upsert, not duplicate |
| Missing forecast    | If no approved forecast exists, CSP may send `currentMonthForecast: 0`; Registry treats Project Set as **Forecast Required**       |

## Registry persistence (mapped from CSP)

Internal models align with CSP shapes. CSP fields map directly where noted.

### `CloudSpendSnapshot` ← `CspConsumptionSnapshot`

| Registry field                      | CSP field                      |
| ----------------------------------- | ------------------------------ |
| `licencePlate`                      | `licencePlate`                 |
| `provider`                          | `provider`                     |
| `periodYear`, `periodMonth`         | `billingPeriod`                |
| `amountToDate`                      | `spendToDate`                  |
| `currency`                          | `currency`                     |
| `projectedMonthEnd`                 | `projectedMonthEnd`            |
| `forecastAmount`                    | `currentMonthForecast`         |
| `varianceAmount`, `variancePercent` | same                           |
| `consumptionPercent`                | `consumptionPercentOfForecast` |
| `asOfDate`                          | `asOf`                         |
| `accounts`                          | `accounts`                     |

### `AccountabilityAlert` ← `CspConsumptionAlert`

| Registry field                      | CSP field                                           |
| ----------------------------------- | --------------------------------------------------- |
| `licencePlate`                      | `licencePlate`                                      |
| `level`                             | `alertType`                                         |
| `milestonePercent`                  | `milestonePercent`                                  |
| `triggeredAt`                       | `triggeredAt`                                       |
| `forecastAmount`                    | `currentMonthForecast`                              |
| `spendToDate`, `projectedMonthEnd`  | same                                                |
| `varianceAmount`, `variancePercent` | same                                                |
| `cspRuleKey`                        | `ruleKey`                                           |
| `status`                            | Registry-owned (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`) |

### `CloudCostForecast` (Registry-owned)

Not supplied by CSP. PO and admins maintain the 24-month forecast in Registry.

| Field                                           | Type     | Notes                                                             |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `licencePlate`                                  | string   |                                                                   |
| `status`                                        | enum     | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SUPERSEDED` |
| `horizonMonths`                                 | number   | Default 24                                                        |
| `monthlyValues`                                 | array    | `{ year, month, amount, currency }`                               |
| `version`                                       | number   |                                                                   |
| `submittedAt`, `submittedById`                  | optional |                                                                   |
| `approvedAt`, `approvedById`                    | optional |                                                                   |
| `rejectedAt`, `rejectedById`, `rejectionReason` | optional |                                                                   |
| `sourceBudgetSnapshot`                          | optional | Copy of `product.budget` at creation                              |

CSP reads approved monthly values when computing `currentMonthForecast` in snapshots and alerts.

### `QuarterlyForecastReview` (Registry-owned)

| Field                              | Type     | Notes                              |
| ---------------------------------- | -------- | ---------------------------------- |
| `licencePlate`                     | string   |                                    |
| `fiscalYear`, `quarter`            | number   | Q1 starts Jan 1                    |
| `forecastMonthsAdded`              | boolean  | Months 13–24 (extend horizon)      |
| `forecastMonthsReviewed`           | boolean  | Full 24-month forecast reviewed    |
| `membersReviewed`                  | boolean  |                                    |
| `spendLookbackReviewed`            | boolean  | Uses `CspConsumptionHistory`       |
| `softQrCompleted`                  | boolean  |                                    |
| `poSignedOff`                      | boolean  |                                    |
| `poSignedOffAt`, `poSignedOffById` | optional |                                    |
| `escalatedAt`                      | optional | M+1 escalation                     |
| `status`                           | enum     | `PENDING`, `COMPLETE`, `ESCALATED` |

---

## Relationship: product budget vs forecast

-   **`product.budget`**: Per-environment estimate at provisioning (eMOU).
-   **`CloudCostForecast`**: Living 24-month plan; source for `currentMonthForecast` in CSP payloads.
-   CSP does not modify forecasts; it compares spend against Registry-approved values.

---

## Registry API surface (illustrative)

### CSP ingest (internal)

| Endpoint                                    | Body                     | Purpose                    |
| ------------------------------------------- | ------------------------ | -------------------------- |
| `PUT /api/internal/csp/consumption`         | `CspConsumptionSnapshot` | Upsert current-month spend |
| `POST /api/internal/csp/alerts`             | `CspConsumptionAlert`    | Record threshold crossing  |
| `PUT /api/internal/csp/consumption/history` | `CspConsumptionHistory`  | Upsert closed-month totals |

Authentication and network path are implementation details outside this spec.

### Product and admin (UI)

| Endpoint                                           | Purpose                                                  |
| -------------------------------------------------- | -------------------------------------------------------- |
| `GET/POST .../forecasts`, `PUT .../forecasts/[id]` | Forecast CRUD                                            |
| `POST .../forecasts/[id]/submit`                   | Submit for approval                                      |
| `POST .../forecasts/[id]/approve`                  | Approve                                                  |
| `GET .../accountability`                           | Status, spend, variance, open alerts                     |
| `GET .../costs`                                    | Current-month spend panel                                |
| `GET/PUT/POST .../quarterly-review`                | Quarterly checklist and PO sign-off                      |
| `POST .../alerts/[id]/acknowledge`, `resolve`      | Owner acknowledge / resolve                              |
| `GET /api/public-cloud/accountability/search`      | Admin governance dashboard                               |
| `POST /api/internal/accountability/jobs`           | Scheduled reminders, escalation, recap (service account) |

---

## Permissions (implemented)

Product-scoped actions use `_permissions` on the decorated product (e.g. `viewAccountability`, `editForecast`). Global session flags:

| Permission                      | Roles                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `viewPublicCloudAccountability` | Admin, public admin/reviewer, billing roles, all users |
| `managePublicCloudCostRules`    | Admin, public admin, billing reviewer, billing manager |

---

## Implementation phases

| Phase                | Deliverable                                     | Status                                 | Jira     |
| -------------------- | ----------------------------------------------- | -------------------------------------- | -------- |
| 1 — Rules config     | `CloudCostRulesConfig` + admin UI               | Done                                   | CR-39    |
| 2 — Forecast CRUD    | Draft, version, submit, approve, reject         | Done                                   | CR-15–18 |
| 3 — CSP ingest       | Accept shapes above; persist snapshots          | Done                                   | CR-29    |
| 4 — Alerts + notify  | Accept `CspConsumptionAlert`; CHES templates    | Done                                   | CR-32–39 |
| 5 — Quarterly review | PO workflow + `CspConsumptionHistory` lookback  | Done                                   | CR-19–27 |
| 6 — Dashboards       | Owner tab, costs page, admin + governance views | Done                                   | CR-23    |
| 7 — Audit            | Notification log + product audit tabs           | Partial — no standalone auditor portal | 7.1–7.5  |
| 8 — Export           | Project + bundled CSV                           | Partial — not Excel                    | CR-41–42 |

---

## Prisma schema (implemented)

```prisma
enum CloudCostForecastStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  SUPERSEDED
}

enum AccountabilityAlertLevel {
  MILESTONE
  PACE
  A1
  A2
  A3
}

enum AccountabilityAlertStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
}

enum QuarterlyReviewStatus {
  PENDING
  COMPLETE
  ESCALATED
}

enum AccountabilityStatus {
  COMPLIANT
  FORECAST_REQUIRED
  FORECAST_REVIEW_REQUIRED
  VARIANCE_REVIEW_REQUIRED
  ESCALATED
  NON_COMPLIANT
}

type ForecastMonthlyValue {
  year   Int
  month  Int
  amount Float
  currency String
}

type SpendAccountBreakdown {
  accountId   String
  environment String?
  spendToDate Float
  currency    String
}

type ClosedMonthSpend {
  year            Int
  month           Int
  currency        String
  actualTotal     Float
  forecastTotal   Float?
  varianceAmount  Float?
  variancePercent Float?
}

model CloudCostForecast {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  licencePlate String
  status      CloudCostForecastStatus
  version     Int
  horizonMonths Int    @default(24)
  monthlyValues ForecastMonthlyValue[]
  submittedAt   DateTime?
  submittedById String?  @db.ObjectId
  approvedAt    DateTime?
  approvedById  String?  @db.ObjectId
  rejectedAt    DateTime?
  rejectedById  String?  @db.ObjectId
  rejectionReason String?
  sourceBudgetSnapshot Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CloudSpendSnapshot {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  licencePlate    String
  provider        Provider
  periodYear      Int
  periodMonth     Int
  currency        String
  amountToDate    Float
  projectedMonthEnd Float
  forecastAmount  Float
  varianceAmount  Float
  variancePercent Float
  consumptionPercent Float
  dayOfMonth      Int?
  daysInMonth     Int?
  asOfDate        DateTime
  accounts        SpendAccountBreakdown[]
  createdAt       DateTime @default(now())
}

model AccountabilityAlert {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  licencePlate      String
  level             AccountabilityAlertLevel
  status            AccountabilityAlertStatus @default(OPEN)
  milestonePercent  Int?
  paceDayOfMonth    Int?
  triggeredAt       DateTime
  periodYear        Int
  periodMonth       Int
  spendToDate       Float
  projectedMonthEnd Float
  forecastAmount    Float
  varianceAmount    Float
  variancePercent   Float
  consumptionPercent Float
  cspRuleKey        String?
  forecastId        String?  @db.ObjectId
  explanation       String?
  acknowledgedAt    DateTime?
  acknowledgedById  String?  @db.ObjectId
  resolvedAt        DateTime?
  resolvedById      String?  @db.ObjectId
  resolutionReason  String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model QuarterlyForecastReview {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId
  licencePlate          String
  fiscalYear            Int
  quarter               Int
  forecastMonthsAdded   Boolean  @default(false)
  forecastMonthsReviewed Boolean @default(false)
  membersReviewed       Boolean  @default(false)
  spendLookbackReviewed Boolean  @default(false)
  softQrCompleted       Boolean  @default(false)
  poSignedOff           Boolean  @default(false)
  poSignedOffAt         DateTime?
  poSignedOffById       String?  @db.ObjectId
  escalatedAt           DateTime?
  status                QuarterlyReviewStatus @default(PENDING)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model CloudSpendHistory {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  licencePlate String
  provider     Provider
  months       ClosedMonthSpend[]
  updatedAt    DateTime @updatedAt
}

model CloudCostAccountabilityState {
  id                 String   @id @default(auto()) @map("_id") @db.ObjectId
  licencePlate       String   @unique
  status             AccountabilityStatus
  highestOpenAlert   AccountabilityAlertLevel?
  activeForecastId   String?  @db.ObjectId
  onEscalationList   Boolean  @default(false)
  evaluatedAt        DateTime
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

`CloudCostRulesConfig` may live in the same database or a separate admin config collection; see [rules configuration](./cloud-cost-rules-config.md).

---

## Related documents

-   [Cloud Cost epic](./cloud-cost.md)
-   [Cloud Cost rules configuration](./cloud-cost-rules-config.md)
-   [Cloud Cost workflows](./cloud-cost-workflows.md)
-   [Cloud Cost UI](./cloud-cost-ui.md)
