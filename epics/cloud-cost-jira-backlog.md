# Cloud Cost — Jira backlog mapping

Tracks [Cloud Cost Accountability](./cloud-cost.md) work against the **Cloud Registry** Jira export (`Jira.csv`, 2026-07-06).

**Implementation branch:** `cursor/public-cloud-provisioning-docs`

**Status legend**

| Status       | Meaning                                          |
| ------------ | ------------------------------------------------ |
| **Done**     | Acceptance criteria met in Registry code         |
| **Partial**  | Shipped with known gaps vs Jira wording          |
| **Deferred** | Explicitly out of scope for Registry engineering |
| **Not done** | No meaningful implementation                     |

---

## Epic rollup

| Key      | Epic                                | Impl.    | Notes                                      |
| -------- | ----------------------------------- | -------- | ------------------------------------------ |
| **CR-1** | Forecasting                         | **Done** | Fiscal grid, save modal, bulk edit, totals |
| **CR-4** | Quarterly Update Cycle & Compliance | **Done** | CR-28 MoU legal update deferred            |
| **CR-5** | Actuals vs Forecast                 | **Done** |                                            |
| **CR-6** | Alerting                            | **Done** | A0–A3, milestones, pace, recap             |
| **CR-7** | Historical Spend                    | **Done** | Dedicated `/costs/history` route           |
| **CR-8** | Export & Reporting                  | **Done** | Excel (`.xlsx`) + CSV export               |

---

## CR-1 — Forecasting

| Key   | Story                                               | Impl.    | Notes                                                          |
| ----- | --------------------------------------------------- | -------- | -------------------------------------------------------------- |
| CR-2  | Rename dashboard title to be cloud-specific         | **Done** | Forecast grid + costs tab use `Azure Spend` / `AWS Spend`      |
| CR-3  | Restructure grid to fiscal-year rows April to March | **Done** | 2 FY rows = 24 months                                          |
| CR-9  | Each fiscal row displays exactly 12 months          | **Done** |                                                                |
| CR-10 | Gray out and lock past months                       | **Done** |                                                                |
| CR-11 | Grand total with color-coded direction indicator    | **Done** | % vs last saved forecast                                       |
| CR-12 | Fiscal-to-fiscal % change under annual totals       | **Done** | Adjacent FY % change                                           |
| CR-13 | Hide annual totals for incomplete fiscal years      | **Done** |                                                                |
| CR-14 | Remove or reword 24-month vs-saved indicator        | **Done** | Kept as reworded “% vs last saved forecast” (product decision) |
| CR-15 | Significant-change modal on save                    | **Done** |                                                                |
| CR-16 | Apply-to-all-future-months on single-month edit     | **Done** |                                                                |
| CR-17 | Explanation field for PO/TL in case of overage      | **Done** | Required on A1+ acknowledge                                    |
| CR-18 | 24-month monthly forecast data structure            | **Done** | `CloudCostForecast`, `horizonMonths: 24`                       |

---

## CR-4 — Quarterly Update Cycle & Compliance

| Key   | Story                                           | Impl.        | Notes                                                              |
| ----- | ----------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| CR-19 | Quarterly update workflow (Jan/Apr/Jul/Oct 1)   | **Done**     | Airflow DAGs + checklist                                           |
| CR-20 | Reminder emails for quarterly updates           | **Done**     |                                                                    |
| CR-21 | Weekly reminder emails until PO sign-off        | **Done**     |                                                                    |
| CR-22 | Director/ED escalation on M+1                   | **Done**     | Configurable `escalationEmails` on cost-rules (fallback: Keycloak) |
| CR-23 | Public Cloud alert — projects out of compliance | **Done**     | `NonComplianceSummary` email + dashboard                           |
| CR-24 | Public Cloud alert for escalation list          | **Done**     | `EscalationListSummary` email + compliance page                    |
| CR-25 | 24-month forecast not complete state            | **Done**     | `FORECAST_REVIEW_REQUIRED`                                         |
| CR-26 | Event-based reminder to update forecast         | **Done**     | CSP alert emails                                                   |
| CR-27 | Explanation language in the registry            | **Done**     | `AccountabilityGuidancePanel`                                      |
| CR-28 | MoU update with new terms and responsibilities  | **Deferred** | Legal/content update outside Registry code                         |

---

## CR-5 — Actuals vs Forecast

| Key   | Story                                           | Impl.    |
| ----- | ----------------------------------------------- | -------- |
| CR-29 | Ingest cloud consumption per license plate      | **Done** |
| CR-30 | Show actuals against forecast per month         | **Done** |
| CR-31 | Compare current month consumption vs forecast % | **Done** |

---

## CR-6 — Alerting

| Key   | Story                                             | Impl.    | Notes                                     |
| ----- | ------------------------------------------------- | -------- | ----------------------------------------- |
| CR-32 | A1 alert to Platform administrators               | **Done** | Configurable `a1AdminEmails`              |
| CR-33 | A1 alert to PO and TL                             | **Done** |                                           |
| CR-34 | A2 alert to Platform administrators and Cloud PO  | **Done** | Configurable `a2AdminEmails`              |
| CR-35 | A2 alert to PO and TL                             | **Done** |                                           |
| CR-36 | A3 alert to admins, Cloud PO, Dir Cloud, Finance  | **Done** | Configurable `a3AdminEmails`              |
| CR-37 | A3 alert to PO and TL                             | **Done** |                                           |
| CR-38 | Monthly recap email bundling A1/A2/A3             | **Done** | Configurable `monthlyRecapEmails`         |
| CR-39 | Spike: A0 pre-emptive alert and threshold notices | **Done** | `PreemptiveThresholdNotice` on CSP ingest |

---

## CR-7 — Historical Spend

| Key   | Story                                        | Impl.    | Notes                                                 |
| ----- | -------------------------------------------- | -------- | ----------------------------------------------------- |
| CR-40 | Separate view for past spend since inception | **Done** | `/public-cloud/products/[licencePlate]/costs/history` |

---

## CR-8 — Export & Reporting

| Key   | Story                                          | Impl.    | Notes                                           |
| ----- | ---------------------------------------------- | -------- | ----------------------------------------------- |
| CR-41 | Export forecast and actuals to Excel (project) | **Done** | `GET .../accountability/export?format=xlsx`     |
| CR-42 | Bundled export per cloud for Finance           | **Done** | `POST .../accountability/export` (xlsx default) |

---

## Cross-walk: internal stories (not in Jira CSV)

| Internal         | Impl.    | Notes                                                                        |
| ---------------- | -------- | ---------------------------------------------------------------------------- |
| Story 1.5 reject | **Done** | API + UI                                                                     |
| Scenario 10      | **Done** | `ForecastSubmitted` email                                                    |
| Stories 6.3–6.4  | **Done** | Consolidated into `/accountability/all` (KPI cards + needs-action preset)    |
| Stories 7.1–7.5  | **Done** | Product audit tabs + `/accountability/audit`                                 |
| Production jobs  | **Done** | Unpause accountability DAGs manually in Airflow after deploy (dev/test/prod) |

---

## Deferred / out of scope

-   **CR-28** — MoU legal/content update (manual/policy process; Registry shows accountability guidance only)
-   **MoU limited-access enforcement** — not automated in Registry (manual ops)

---

## Related documents

-   [Cloud Cost epic](./cloud-cost.md)
-   [UI specification](./cloud-cost-ui.md)
-   [Rules configuration](./cloud-cost-rules-config.md)
-   [Email scenarios](./cloud-cost-email-scenarios.md)
