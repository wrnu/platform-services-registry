# Cloud Cost — Jira backlog mapping

Tracks [Cloud Cost Accountability](./cloud-cost.md) work against the **Cloud Registry** Jira export (`Jira.csv`, 2026-07-06). Update this file when Jira status or branch implementation changes.

**Implementation branch:** `cursor/public-cloud-provisioning-docs` (fork PR — see repo maintainer)

**Status legend**

| Status       | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| **Done**     | Acceptance criteria met in Registry code on the accountability branch |
| **Partial**  | Shipped with known gaps vs Jira wording                               |
| **Deferred** | Explicitly out of scope for this delivery                             |
| **Not done** | No meaningful implementation                                          |

---

## Epic rollup

| Key      | Epic                                | Jira status     | Implementation | Notes                                                         |
| -------- | ----------------------------------- | --------------- | -------------- | ------------------------------------------------------------- |
| **CR-1** | Forecasting                         | Product Backlog | **Partial**    | Grid, 24-month data, save modal, bulk edit — see CR-2, CR-14  |
| **CR-4** | Quarterly Update Cycle & Compliance | Product Backlog | **Partial**    | Workflow + emails + compliance; CR-24 partial; CR-28 deferred |
| **CR-5** | Actuals vs Forecast                 | Product Backlog | **Done**       | CSP ingest, current-month variance, actuals in grid           |
| **CR-6** | Alerting                            | Product Backlog | **Done**       | A0–A3, milestones, pace, monthly recap, notification audit    |
| **CR-7** | Historical Spend                    | Product Backlog | **Partial**    | History panel on costs tab; not a dedicated route (CR-40)     |
| **CR-8** | Export & Reporting                  | Product Backlog | **Partial**    | CSV export; Jira asks for Excel (CR-41, CR-42)                |

---

## CR-1 — Forecasting

| Key   | Story                                                      | Jira status     | Impl.       | Notes                                                                                                                                 |
| ----- | ---------------------------------------------------------- | --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CR-2  | Rename dashboard title to be cloud-specific                | Product Backlog | **Partial** | Forecast grid row uses `Azure Spend` / `AWS Spend` (`getProviderSpendLabel`). Costs page title still **"Current month cloud spend"**. |
| CR-3  | Restructure grid to fiscal-year rows April to March        | Product Backlog | **Done**    | `getFiscalYearChunks()`, FY labels, April–March rows. **2 FY rows = 24 months** (product decision; epic text mentions 3 FY).          |
| CR-9  | Ensure each fiscal row displays exactly 12 months          | Product Backlog | **Done**    | `chunkByFiscalYear` + unit tests                                                                                                      |
| CR-10 | Gray out and lock past months                              | Product Backlog | **Done**    | Past cells read-only; `preserveLockedPastMonthlyValues` on save                                                                       |
| CR-11 | Display grand total with color-coded direction indicator   | Product Backlog | **Done**    | 24-month grand total; red/green **% vs last saved forecast**                                                                          |
| CR-12 | Show fiscal-to-fiscal percent change under annual totals   | Product Backlog | **Done**    | Adjacent FY % change (`getAdjacentFiscalYearPercentChange`)                                                                           |
| CR-13 | Hide annual totals for incomplete fiscal years             | Product Backlog | **Done**    | In-progress FY shows "In progress" / no misleading total                                                                              |
| CR-14 | Remove or reword the 24-month vs-saved indicator           | Product Backlog | **Partial** | **Reworded** to "% vs last saved forecast" under grand total (not removed)                                                            |
| CR-15 | Significant-change modal on save with scoped justification | Product Backlog | **Done**    | Lists increased months; justification + one-time/ongoing on save                                                                      |
| CR-16 | Apply-to-all-future-months option on single-month edit     | Product Backlog | **Done**    | Per-cell **Apply to all future months**                                                                                               |
| CR-17 | Explanation field for PO/TL in case of overage             | Product Backlog | **Done**    | Required overage explanation on A1/A2/A3 acknowledge                                                                                  |
| CR-18 | 24-month monthly forecast data structure in registry       | Product Backlog | **Done**    | `CloudCostForecast`, `horizonMonths: 24`, versioned `monthlyValues`                                                                   |

**Primary code:** `ProjectBudgetForecastPanel.tsx`, `forecast-grid-utils.ts`, `public-cloud-accountability.ts`

---

## CR-4 — Quarterly Update Cycle & Compliance

| Key   | Story                                                      | Jira status     | Impl.        | Notes                                                                                                              |
| ----- | ---------------------------------------------------------- | --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| CR-19 | Quarterly update workflow (Jan/Apr/Jul/Oct 1)              | Product Backlog | **Done**     | Airflow `accountability_jobs_*` → quarterly reminder job; checklist + API                                          |
| CR-20 | Reminder emails for quarterly updates                      | Product Backlog | **Done**     | `QuarterlyForecastReminder.tsx` on months `[1,4,7,10]`                                                             |
| CR-21 | Weekly reminder emails until PO sign-off                   | Product Backlog | **Done**     | `runWeeklySignOffReminderJob` → `QuarterlySignOffReminder.tsx`                                                     |
| CR-22 | Director/ED escalation on M+1 if sign-off missing          | Product Backlog | **Partial**  | M+1 job + `QuarterlyEscalation.tsx`. Recipients = **global Keycloak roles**, not ministry Director/ED contacts     |
| CR-23 | Public Cloud alert with list of projects out of compliance | Product Backlog | **Done**     | `NonComplianceSummary.tsx` on quarter start; `/public-cloud/accountability/all`                                    |
| CR-24 | Public Cloud alert for escalation list                     | Product Backlog | **Partial**  | `/public-cloud/accountability/compliance` + recap flags `onEscalationList`. **No dedicated escalation-only email** |
| CR-25 | 24-month forecast not complete state in registry           | Product Backlog | **Done**     | `FORECAST_REVIEW_REQUIRED` via `isForecastHorizonComplete()`                                                       |
| CR-26 | Event-based reminder to update forecast                    | Product Backlog | **Done**     | CSP milestone/pace/A1–A3 emails link to accountability / forecast update                                           |
| CR-27 | Explanation language in the registry                       | Product Backlog | **Done**     | `AccountabilityGuidancePanel` + email copy                                                                         |
| CR-28 | MoU update with new terms and responsibilities             | Product Backlog | **Deferred** | Out of scope — eMOU exists; no new accountability MoU terms or limited-access enforcement in Registry              |

**Primary code:** `AccountabilityQuarterlyChecklist.tsx`, `services/accountability/jobs.ts`, `accountability-emails.ts`

---

## CR-5 — Actuals vs Forecast

| Key   | Story                                                    | Jira status     | Impl.    | Notes                                                                                 |
| ----- | -------------------------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------- |
| CR-29 | Ingest cloud consumption per license plate               | Product Backlog | **Done** | `PUT /api/internal/csp/consumption`, `POST .../alerts`, `PUT .../consumption/history` |
| CR-30 | Show actuals against forecast per month in registry      | Product Backlog | **Done** | Actual row in forecast grid; `HistoricalSpendPanel` table                             |
| CR-31 | Compare current month consumption vs forecast as percent | Product Backlog | **Done** | `consumptionPercent` on snapshot + `CurrentMonthSpendPanel`                           |

**Primary code:** `public-cloud-accountability.ts`, `CurrentMonthSpendPanel.tsx`, `HistoricalSpendPanel.tsx`

---

## CR-6 — Alerting

| Key   | Story                                                         | Jira status     | Impl.       | Notes                                                                                                |
| ----- | ------------------------------------------------------------- | --------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| CR-32 | A1 alert to Platform administrators                           | Product Backlog | **Done**    | `CostAlertA1Admin.tsx`                                                                               |
| CR-33 | A1 alert to Project PO and TL with update-forecast prompt     | Product Backlog | **Done**    | `CostAlertA1.tsx`                                                                                    |
| CR-34 | A2 alert to Platform administrators and Cloud PO              | Product Backlog | **Done**    | `CostAlertA2Admin.tsx` (billing-reviewer cohort)                                                     |
| CR-35 | A2 alert to Project PO and TL with update-forecast prompt     | Product Backlog | **Done**    | `CostAlertA2.tsx`                                                                                    |
| CR-36 | A3 alert to Platform admins, Cloud PO, Dir Cloud, Dir Finance | Product Backlog | **Partial** | `CostAlertA3Admin.tsx` to global admin/billing roles — **Director/Finance routing not configurable** |
| CR-37 | A3 alert to Project PO and TL with update-forecast prompt     | Product Backlog | **Done**    | `CostAlertA3.tsx`                                                                                    |
| CR-38 | Monthly recap email bundling A1/A2/A3                         | Product Backlog | **Done**    | `MonthlyAccountabilityRecap.tsx` on 1st of month                                                     |
| CR-39 | Spike: A0 pre-emptive alert and threshold notices             | Product Backlog | **Done**    | `evaluatePreemptiveNotice()`, `PreemptiveThresholdNotice.tsx`, on CSP consumption ingest             |

**Primary code:** `cloud-cost-rules.ts`, `accountability-emails.ts`, cost-rules admin UI (pre-emptive thresholds)

---

## CR-7 — Historical Spend

| Key   | Story                                                | Jira status     | Impl.       | Notes                                                                   |
| ----- | ---------------------------------------------------- | --------------- | ----------- | ----------------------------------------------------------------------- |
| CR-40 | Separate view for past spend since project inception | Product Backlog | **Partial** | `HistoricalSpendPanel` on **Costs** tab — section, not standalone route |

**Primary code:** `HistoricalSpendPanel.tsx`, `costs/page.tsx`

---

## CR-8 — Export & Reporting

| Key   | Story                                                 | Jira status     | Impl.       | Notes                                                                                                       |
| ----- | ----------------------------------------------------- | --------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| CR-41 | Export forecast and actuals to Excel at project level | Product Backlog | **Partial** | `GET .../accountability/export` → **CSV** (`{licencePlate}-accountability.csv`)                             |
| CR-42 | Bundled export per cloud for Finance                  | Product Backlog | **Partial** | `POST /api/public-cloud/accountability/export` + button on `/accountability/all` — **CSV**, provider filter |

**Primary code:** `public-cloud-accountability.ts` (`buildAccountabilityExportRows`), export routes

---

## Cross-walk: Jira ↔ internal epic stories

Internal story IDs are defined in [cloud-cost.md](./cloud-cost.md). Mapping for traceability:

| Jira               | Internal stories / scenarios                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| CR-1 (CR-2–CR-18)  | Feature 1 (1.1–1.6), forecast grid UX                                                                 |
| CR-4 (CR-19–CR-28) | Story 1.6, Feature 5 (5.6–5.8), Scenario 6–9                                                          |
| CR-5 (CR-29–CR-31) | Feature 2 (2.1–2.5)                                                                                   |
| CR-6 (CR-32–CR-39) | Feature 5 (5.1–5.5, 5.9), rules config                                                                |
| CR-7 (CR-40)       | Feature 2 / costs UI                                                                                  |
| CR-8 (CR-41–CR-42) | Finance reporting (not in original Feature list)                                                      |
| —                  | Story 1.5 reject → shipped (no Jira key in export)                                                    |
| —                  | Scenario 10 forecast submitted → shipped                                                              |
| —                  | Stories 6.3–6.4 director/executive dashboards → shipped                                               |
| —                  | Stories 7.1–7.5 audit → **Partial** (product tabs + `/accountability/audit`; not full auditor portal) |

---

## Remaining gaps (recommended next work)

1. **CR-2** — Provider-specific title on costs page (`Azure Spend` / `AWS Spend`).
2. **CR-41 / CR-42** — Excel (`.xlsx`) export or document CSV as accepted substitute.
3. **CR-24** — Dedicated escalation-list alert email.
4. **CR-22 / CR-36** — Configurable admin notification routing (Director/ED/Finance) — see [rules config](./cloud-cost-rules-config.md).
5. **CR-40** — Dedicated historical-spend route if "separate view" requires its own page.
6. **CR-14** — Final UX decision: keep reworded indicator or remove.
7. **CR-28** — MoU legal/content update (deferred; separate from Registry engineering).
8. **Production** — Unpause Airflow `accountability_jobs_*` DAGs; CSP + CHES in target environments.

---

## Related documents

-   [Cloud Cost epic](./cloud-cost.md) — internal features, stakeholders, implementation status
-   [UI specification](./cloud-cost-ui.md) — routes and components
-   [Email scenarios](./cloud-cost-email-scenarios.md) — CHES templates
-   [Data model](./cloud-cost-data-model.md) — Prisma and CSP shapes
