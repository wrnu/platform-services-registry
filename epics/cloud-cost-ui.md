# Cloud Cost UI Specification

UI routes and components for the [Cloud Cost Accountability epic](./cloud-cost.md).

**Status:** MVP implemented. Gaps: forecast reject UI (Story 1.5), director/executive dashboards (6.3–6.4), dedicated audit history views (7.x).

## Navigation (implemented)

### Product tabs

`COSTS` tab on the Public Cloud product layout (`app/app/public-cloud/products/(product)/[licencePlate]/layout.tsx`). Spend accountability (forecasts, alerts, quarterly review) lives on the **PRODUCT** tab under **Project budget and spend forecast**.

| Tab                                        | Route                                         |
| ------------------------------------------ | --------------------------------------------- |
| PRODUCT (includes budget & accountability) | `/public-cloud/products/[licencePlate]/edit`  |
| COSTS                                      | `/public-cloud/products/[licencePlate]/costs` |

Legacy `/accountability` URLs redirect to `/edit`.

### Admin navigation

| Route                                     | Purpose                                        | Status |
| ----------------------------------------- | ---------------------------------------------- | ------ |
| `/public-cloud/accountability/all`        | Cross-project governance dashboard (Story 6.2) | Done   |
| `/public-cloud/accountability/compliance` | Escalation list (`onEscalationList`)           | Done   |
| `/admin/public-cloud/cost-rules`          | Rules configuration (RC.1–RC.3)                | Done   |

---

## Product budget and spend accountability

**Route:** `/public-cloud/products/[licencePlate]/edit` (accordion section)
**Component:** `PublicCloudProjectBudgetSection` + `edit/page.tsx`
**Legacy redirect:** `accountability/page.tsx` → `/edit`

### Status header

| Element                     | Source                                |
| --------------------------- | ------------------------------------- |
| Accountability status badge | `CloudCostAccountabilityState.status` |
| Open alert level            | Highest open `AccountabilityAlert`    |
| Last CSP refresh            | `CloudSpendSnapshot.asOfDate`         |
| Currency                    | Provider (USD / CAD)                  |

### Current month panel

Shared component: `app/components/public-cloud/costs/CurrentMonthSpendPanel.tsx` (also on costs tab).

| Field                     | CSP / Registry field                |
| ------------------------- | ----------------------------------- |
| Approved forecast         | `forecastAmount` on snapshot        |
| Spend to date             | `amountToDate`                      |
| Projected month-end       | `projectedMonthEnd`                 |
| Variance ($ and %)        | `varianceAmount`, `variancePercent` |
| Consumption % of forecast | `consumptionPercent`                |

### Forecast section

Component: `ForecastGrid.tsx`

-   24-month grid: year-month, amount, currency
-   Actions: **Create draft**, **Edit draft**, **Submit**, **Approve** (billing reviewer)
-   **Reject** — not implemented (Story 1.5)
-   Version list via forecast `version` field (no separate history drawer yet)

### Quarterly review section

Component: `AccountabilityQuarterlyChecklist.tsx`

| Checklist item         | Registry field           |
| ---------------------- | ------------------------ |
| Months 21–24 added     | `forecastMonthsAdded`    |
| 21 months reviewed     | `forecastMonthsReviewed` |
| Members reviewed       | `membersReviewed`        |
| 3-month spend reviewed | `spendLookbackReviewed`  |
| Soft QR complete       | `softQrCompleted`        |
| PO sign-off            | `poSignedOff`            |

Primary action: **Sign off** (PO).

### Open alerts panel

Component: `AlertResponseModal.tsx`

-   Levels: `MILESTONE`, `PACE`, `A1`–`A3`
-   Actions: **Acknowledge**, **Explain**, **Resolve**
-   Explanation stored on alert record

### Spend history

Closed months from `CloudSpendHistory` when CSP has posted history ingest.

---

## Product costs page

**Route:** `/public-cloud/products/[licencePlate]/costs`
**Page:** `costs/page.tsx`

Current-month spend panel and link to accountability tab for forecast context.

---

## Admin governance dashboard

**Route:** `/public-cloud/accountability/all`

| Column                   | Notes                               |
| ------------------------ | ----------------------------------- |
| Licence plate            | Link to product accountability page |
| Product name             |                                     |
| Provider                 | AWS / Azure                         |
| Accountability status    | Filterable                          |
| Open alert               | Highest level                       |
| Forecast compliance      | Quarterly sign-off state            |
| Current month variance % |                                     |
| Escalation flag          | `onEscalationList`                  |

Features: filter panel, pagination via `GET /api/public-cloud/accountability/search`.

---

## Permissions (implemented)

Global session flags (`app/core/auth-options.ts`):

| Action                               | Permission / gate                                                           |
| ------------------------------------ | --------------------------------------------------------------------------- |
| View accountability tab, admin lists | `viewPublicCloudAccountability`                                             |
| Rules config admin UI                | `viewPublicCloudAccountability` (read), `managePublicCloudCostRules` (edit) |
| Edit / submit forecast               | Product `_permissions` (PO, TL, product members)                            |
| Approve forecast                     | `billing-reviewer` / billing manager roles                                  |
| PO quarterly sign-off                | PO on product + quarterly review API                                        |
| Acknowledge / resolve alert          | Product members with accountability access                                  |

---

## API dependencies

| UI area             | API                                           |
| ------------------- | --------------------------------------------- |
| Status + spend      | `GET .../accountability`                      |
| Current month costs | `GET .../costs`                               |
| Forecast CRUD       | `GET/POST/PUT .../forecasts`                  |
| Submit / approve    | `POST .../forecasts/[id]/submit`, `approve`   |
| Quarterly review    | `GET/PUT/POST .../quarterly-review`           |
| Alerts              | `POST .../alerts/[id]/acknowledge`, `resolve` |
| Admin list          | `GET /api/public-cloud/accountability/search` |
| CSP data            | Internal ingest (not user-facing)             |

See [data model](./cloud-cost-data-model.md#registry-api-surface-illustrative).

---

## Component map

| Component                          | Path                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `ForecastGrid`                     | `components/public-cloud/accountability/ForecastGrid.tsx`                     |
| `AccountabilityQuarterlyChecklist` | `components/public-cloud/accountability/AccountabilityQuarterlyChecklist.tsx` |
| `AlertResponseModal`               | `components/public-cloud/accountability/AlertResponseModal.tsx`               |
| `CurrentMonthSpendPanel`           | `components/public-cloud/costs/CurrentMonthSpendPanel.tsx`                    |

---

## Related documents

-   [Cloud Cost workflows](./cloud-cost-workflows.md)
-   [Data model](./cloud-cost-data-model.md)
-   [Email scenarios](./cloud-cost-email-scenarios.md)
