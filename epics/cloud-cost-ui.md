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

User-facing labels (nav menu and page titles):

| Nav label                   | Page title                  | Route                                   |
| --------------------------- | --------------------------- | --------------------------------------- |
| Public Cloud Accountability | Public Cloud Accountability | `/public-cloud/accountability/all`      |
| Public Cloud Forecast       | Public Cloud Forecast       | `/public-cloud/accountability/forecast` |
| Public Cloud Notifications  | Notification log            | `/public-cloud/accountability/audit`    |
| Public Cloud Cost Rules     | Public Cloud Cost Rules     | `/admin/public-cloud/cost-rules`        |

| Route                                   | Purpose                                                                                                              | Jira        | Status |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| `/public-cloud/accountability/all`      | Governance dashboard: KPI cards + presets (Stories 6.2–6.4)                                                          | CR-23/CR-24 | Done   |
| `/public-cloud/accountability/forecast` | "Public Cloud Forecast": read-only forecast/actuals/variance rollup with expandable product line items; Excel export | —           | Done   |
| `/public-cloud/accountability/audit`    | Notification log (Story 7.5)                                                                                         | —           | Done   |
| `/admin/public-cloud/cost-rules`        | Public Cloud Cost Rules (RC.1–RC.3)                                                                                  | CR-39       | Done   |

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

-   Rolling 24-month grid: fiscal-year rows (April–March) from the start of the current FY through
    current month + 23, so a partial third FY row appears whenever needed; provider spend label
    (`Azure Spend` / `AWS Spend`)
-   Past months grayed out and locked; all current/future months (including previously confirmed
    ones) stay editable in a draft
-   Quarterly forecast-review banner shows confirmation progress for the full rolling 24-month
    window and provides a single primary action to confirm all current/future cells and mark the
    forecast reviewed after changes are saved; PO sign-off remains a separate final step
-   Grand total with direction vs last saved forecast; adjacent FY % change (full years only)
-   Actuals row when CSP history exists (CR-30)
-   Actions: **Create draft** (seeded from the active approved forecast when one exists, otherwise
    from product budget), **Edit draft**, **Submit**, **Approve**, **Reject** (billing reviewer, Story 1.5)
-   Significant-change modal on save (CR-15); apply-to-all-future-months (CR-16)
-   Bulk fill: copy value across range, confirm all suggested
-   Audit history tabs via `AccountabilityAuditHistory.tsx` (Stories 7.1–7.5)

See [Video review feedback](#video-review-feedback-july-2026) for changes requested during the
Project Registry document walkthrough.

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

### Video review feedback (July 2026)

Feedback from the Project Registry (PR) document video review. Scope for this pass is the **edit
page** (`/public-cloud/products/[licencePlate]/edit`); the new project **creation page** is out of
scope for the first release unless noted.

| Area                            | Request                                                                                                                 | Rationale                                                                                                                                                                                                 | Status        | Implementation                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New project creation            | Add forecast section to the creation page                                                                               | Teams should be able to enter forecasts at project setup                                                                                                                                                  | **Deferred**  | Acceptable to omit for v1 to keep creation simple. Add in a future release. Creation page (`/public-cloud/products/create`) still shows static budget estimates only.                                                                                                                                                                                                                                         |
| Project budget & spend forecast | Remove static "Estimated average monthly spend" text and per-account inputs (Dev, Test, Prod, Tools) from the edit page | Superseded by the fiscal-year forecast grid; static estimates are no longer needed on this page                                                                                                           | **Done**      | Removed `Budget` component from `PublicCloudProjectBudgetSection` on the edit page. Budget inputs remain on create and request pages.                                                                                                                                                                                                                                                                         |
| Project budget & spend forecast | Keep accountability explanation text and tooltips                                                                       | Reviewer praised clarity for teams                                                                                                                                                                        | **No change** | `AccountabilityGuidancePanel` and existing forecast copy unchanged.                                                                                                                                                                                                                                                                                                                                           |
| Current month spend             | Keep projected month-end, >10% variance, and per-account breakdown (dev, test, prod)                                    | Reviewer confirmed this breakdown works well                                                                                                                                                              | **No change** | `CurrentMonthSpendPanel` unchanged.                                                                                                                                                                                                                                                                                                                                                                           |
| Bulk fill                       | Remove **Apply % growth** entirely                                                                                      | One-click blanket growth risks over-inflating forecasts; teams should calculate and enter growth manually                                                                                                 | **Done**      | Removed popover UI from `ProjectBudgetForecastPanel` and `applyPercentGrowthToEditableMonths` from `forecast-grid-utils.ts`. Copy-across and confirm-all bulk actions remain.                                                                                                                                                                                                                                 |
| Fiscal year forecast table      | Show a consistent rolling **24-month** forecast                                                                         | Grid showed only two fiscal-year rows (~21 fillable months mid-year); a third row (e.g. FY 28/29) is required                                                                                             | **Done**      | `buildRollingFiscalForecastMonths` spans current FY start (April) through current month + 23. Produces three fiscal-year chunks when needed, with the third labelled as a partial year at the end of the rolling window.                                                                                                                                                                                      |
| Fiscal year forecast table      | Past months grayed out and uneditable                                                                                   | Historical months should reflect actuals, not user edits                                                                                                                                                  | **Done**      | `isPastMonth` + `preserveLockedPastMonthlyValues` lock past cells in the UI and on save.                                                                                                                                                                                                                                                                                                                      |
| Fiscal year forecast table      | Future months must be editable                                                                                          | Reviewer could not edit future-month cells when projections needed updating                                                                                                                               | **Done**      | Two fixes: (1) confirmed future cells stay editable in draft mode (confirmation is visual only); (2) creating a new draft seeds from the active approved forecast via `seedForecastDraftValues`, with button label **Edit forecast** when an approved forecast exists.                                                                                                                                        |
| Quarterly review completion     | Add an explicit way to persist forecast-review completion for the entire forecast                                       | `Confirm all suggested` was only a local visual state and did not clearly complete the quarterly review; each quarterly review should cover the full rolling 24-month forecast, not just the next quarter | **Done**      | Added a single quarterly forecast-review banner in `ProjectBudgetForecastPanel` with progress (`x / 24 months confirmed`). After edits are saved, its primary action confirms all current/future forecast cells and sets `forecastMonthsReviewed` and `forecastMonthsAdded` through the quarterly-review API. Review highlighting stops once this saved checklist item is true; PO sign-off remains separate. |

**Key files changed**

| File                                                                    | Change                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `components/public-cloud/accountability/forecast-grid-utils.ts`         | Rolling 24-month horizon builder; removed growth helper; partial-FY detection  |
| `components/public-cloud/accountability/ProjectBudgetForecastPanel.tsx` | Removed growth UI; fixed cell editability; partial-FY labels                   |
| `components/public-cloud/sections/PublicCloudProjectBudgetSection.tsx`  | Removed static budget inputs; updated create/edit forecast action              |
| `services/db/public-cloud-accountability.ts`                            | `seedForecastDraftValues`; rolling horizon for platform rollup and budget seed |
| `app/api/public-cloud/products/[licencePlate]/forecasts/route.ts`       | Draft creation uses `seedForecastDraftValues`                                  |

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

| UI area                    | API                                                          |
| -------------------------- | ------------------------------------------------------------ |
| Status + spend             | `GET .../accountability`                                     |
| Current month costs        | `GET .../costs`                                              |
| Forecast CRUD              | `GET/POST/PUT .../forecasts`                                 |
| Submit / approve / reject  | `POST .../forecasts/[id]/submit`, `approve`, `reject`        |
| Export (project)           | `GET .../accountability/export` (CSV)                        |
| Export (bundled)           | `POST /api/public-cloud/accountability/export`               |
| Export (platform forecast) | `GET /api/public-cloud/accountability/forecast/export`       |
| Notification log search    | `POST /api/public-cloud/accountability/notifications/search` |
| Quarterly review           | `GET/PUT/POST .../quarterly-review`                          |
| Alerts                     | `POST .../alerts/[id]/acknowledge`, `resolve`                |
| Admin list                 | `GET /api/public-cloud/accountability/search`                |
| CSP data                   | Internal ingest (not user-facing)                            |

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
