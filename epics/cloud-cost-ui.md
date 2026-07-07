# Cloud Cost UI Specification

UI routes and components for the [Cloud Cost Accountability epic](./cloud-cost.md).

**Status:** Jira CR-1–CR-42 complete on accountability branch (CR-28 MoU deferred). See [Jira backlog mapping](./cloud-cost-jira-backlog.md).

## Navigation (implemented)

### Product tabs

`COSTS` tab on the Public Cloud product layout (`app/app/public-cloud/products/(product)/[licencePlate]/layout.tsx`). Spend accountability (forecasts, alerts, quarterly review) lives on the **PRODUCT** tab under **Project budget and spend forecast**.

| Tab                                        | Route                                                 |
| ------------------------------------------ | ----------------------------------------------------- |
| PRODUCT (includes budget & accountability) | `/public-cloud/products/[licencePlate]/edit`          |
| COSTS                                      | `/public-cloud/products/[licencePlate]/costs`         |
| Historical spend                           | `/public-cloud/products/[licencePlate]/costs/history` |

Legacy `/accountability` URLs redirect to `/edit`.

### Admin navigation

| Route                                   | Purpose                                                                                 | Jira        | Status |
| --------------------------------------- | --------------------------------------------------------------------------------------- | ----------- | ------ |
| `/public-cloud/accountability/all`      | Governance dashboard: KPI cards + presets (Stories 6.2–6.4)                             | CR-23/CR-24 | Done   |
| `/public-cloud/accountability/forecast` | "Public Cloud Forecast": read-only forecast, actuals and variance rollup (per currency) | —           | Done   |
| `/public-cloud/accountability/audit`    | Notification audit log (Story 7.5)                                                      | —           | Done   |
| `/admin/public-cloud/cost-rules`        | Rules configuration (RC.1–RC.3)                                                         | CR-39       | Done   |

The former `compliance` (CR-24, Story 6.2), `director` (Story 6.3), and `executive` (Story 6.4)
routes are consolidated into `/all` as the **Escalation list** / **Needs action** presets and the
KPI summary cards; the old URLs redirect with the matching preset applied (email links still work).

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

Component: `ProjectBudgetForecastPanel.tsx` (fiscal-year grid in `forecast-grid-utils.ts`)

-   24-month grid: fiscal-year rows (April–March), provider spend label (`Azure Spend` / `AWS Spend`)
-   Grand total with direction vs last saved forecast; adjacent FY % change
-   Actuals row when CSP history exists (CR-30)
-   Actions: **Create draft**, **Edit draft**, **Submit**, **Approve**, **Reject** (billing reviewer, Story 1.5)
-   Significant-change modal on save (CR-15); apply-to-all-future-months (CR-16)
-   Audit history tabs via `AccountabilityAuditHistory.tsx` (Stories 7.1–7.5)

### Quarterly review section

Component: `AccountabilityQuarterlyChecklist.tsx`

| Checklist item             | Registry field           | Notes (24-month horizon) |
| -------------------------- | ------------------------ | ------------------------ |
| Months 13–24 added         | `forecastMonthsAdded`    | Extend rolling horizon   |
| 24-month forecast reviewed | `forecastMonthsReviewed` |                          |
| Members reviewed           | `membersReviewed`        |                          |
| 3-month spend reviewed     | `spendLookbackReviewed`  |                          |
| Soft QR complete           | `softQrCompleted`        |                          |
| PO sign-off                | `poSignedOff`            |                          |

Primary action: **Sign off** (PO).

### Open alerts panel

Component: `AlertResponseModal.tsx`

-   Levels: `MILESTONE`, `PACE`, `A1`–`A3`
-   Actions: **Acknowledge** (overage explanation required for A1+), **Resolve**
-   Explanation stored on alert record (CR-17)

### Audit history

Component: `AccountabilityAuditHistory.tsx` — tabs for forecast versions, alert history, notification log, quarterly escalations.

### Spend history

`HistoricalSpendPanel.tsx` on the costs tab (summary) and dedicated route `/costs/history` (CR-40).

---

## Product costs page

**Route:** `/public-cloud/products/[licencePlate]/costs`
**Page:** `costs/page.tsx`

Current-month spend panel, historical summary, link to full history route, Excel export. Page title uses provider spend label (CR-2).

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

Features: KPI summary cards (active / needing action / escalated / open alerts), view presets
(All projects / Needs action / Escalation list), filter panel, pagination, bundled Excel export
(CR-42; CSV via API `format=csv`).

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

| UI area                   | API                                                          |
| ------------------------- | ------------------------------------------------------------ |
| Status + spend            | `GET .../accountability`                                     |
| Current month costs       | `GET .../costs`                                              |
| Forecast CRUD             | `GET/POST/PUT .../forecasts`                                 |
| Submit / approve / reject | `POST .../forecasts/[id]/submit`, `approve`, `reject`        |
| Export (project)          | `GET .../accountability/export` (CSV)                        |
| Export (bundled)          | `POST /api/public-cloud/accountability/export`               |
| Notification audit search | `POST /api/public-cloud/accountability/notifications/search` |
| Quarterly review          | `GET/PUT/POST .../quarterly-review`                          |
| Alerts                    | `POST .../alerts/[id]/acknowledge`, `resolve`                |
| Admin list                | `GET /api/public-cloud/accountability/search`                |
| CSP data                  | Internal ingest (not user-facing)                            |

See [data model](./cloud-cost-data-model.md#registry-api-surface-illustrative).

---

## Component map

| Component                          | Path                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `ProjectBudgetForecastPanel`       | `components/public-cloud/accountability/ProjectBudgetForecastPanel.tsx`       |
| `AccountabilityAuditHistory`       | `components/public-cloud/accountability/AccountabilityAuditHistory.tsx`       |
| `AccountabilityGuidancePanel`      | `components/public-cloud/accountability/AccountabilityGuidancePanel.tsx`      |
| `AccountabilityQuarterlyChecklist` | `components/public-cloud/accountability/AccountabilityQuarterlyChecklist.tsx` |
| `AlertResponseModal`               | `components/public-cloud/accountability/AlertResponseModal.tsx`               |
| `CurrentMonthSpendPanel`           | `components/public-cloud/costs/CurrentMonthSpendPanel.tsx`                    |
| `HistoricalSpendPanel`             | `components/public-cloud/costs/HistoricalSpendPanel.tsx`                      |

---

## Related documents

-   [Cloud Cost workflows](./cloud-cost-workflows.md)
-   [Data model](./cloud-cost-data-model.md)
-   [Email scenarios](./cloud-cost-email-scenarios.md)
-   [Jira backlog mapping](./cloud-cost-jira-backlog.md)
