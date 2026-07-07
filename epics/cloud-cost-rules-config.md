# Cloud Cost Rules Configuration

Companion specification for the [Cloud Cost Accountability epic](./cloud-cost.md). Rules configuration is a prerequisite feature: governance thresholds and schedules should be **data**, not application code.

Business rules below are sourced from the [governance whiteboard](./cloud-cost.md#business-workflow-governance-whiteboard).

## Goal

Allow authorized administrators to define, version, and audit the policy rules that drive forecast compliance, variance alerts, reminders, and escalations across all Public Cloud Project Sets.

## Configuration domains

| Domain                 | Purpose                                    | Examples                            |
| ---------------------- | ------------------------------------------ | ----------------------------------- |
| Variance thresholds    | Map spend vs forecast to A1–A3             | +10%, +50% / +$500, +200% / +$2,000 |
| Consumption milestones | Progressive notices before variance alerts | 50%, 80%, 100%, +25% steps          |
| Early pace warnings    | Mid-month pace checks                      | 50% of forecast by day 10           |
| Forecast policy        | Rolling horizon and quarterly cycle        | 24 months; updates on quarter start |
| Quarterly review       | PO obligations each quarter                | Soft QR, member review, PO sign-off |
| Reminder cadence       | Nudge owners until complete                | Weekly until PO sign-off            |
| Escalation policy      | Director visibility                        | M+1 after quarter start             |
| Notification routing   | Admin vs project recipients                | Per alert level                     |
| Projection defaults    | Month-end spend methodology                | Linear extrapolation (MVP default)  |

## Alert levels (business rules)

Consumption is compared to the **current month’s approved forecast**. Evaluate **percentage and dollar** rules; assign the **highest severity** that matches.

### Consumption milestones (project team)

Not variance alerts — informational notices to **Project PO** and **Technical Lead**.

| Milestone       | Trigger                                    |
| --------------- | ------------------------------------------ |
| First tier      | **50%** of current-month forecast consumed |
| Second tier     | **80%** of forecast consumed               |
| Third tier      | **100%** of forecast consumed              |
| Beyond forecast | Every additional **25%** (125%, 150%, …)   |

Channel: email (CHES). Automation type: **T** (tooling evaluates; **E** sends email).

### Early pace warning

Configurable mid-month rule when spend pace is unusually high.

| Setting        | Example from whiteboard           |
| -------------- | --------------------------------- |
| Pace threshold | **50%** of current-month forecast |
| Calendar day   | By **day 10** of the month        |

Recipients: **Project PO** and **Technical Lead**. Distinct from A1–A3.

### Variance alerts A1–A3

| Level  | Trigger                                                                              | Admin recipients                                                             | Project recipients                  |
| ------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------- |
| **A1** | Spend **> +10%** above forecast                                                      | Platform admins                                                              | PO + TL (prompt to update forecast) |
| **A2** | Spend **> +50%** above forecast **OR** **> +$500** above forecast                    | Platform admins + **Cloud PO**                                               | PO + TL                             |
| **A3** | Spend **> +200%** above forecast (min **+$500**) **OR** **> +$2,000** above forecast | Platform admins + Cloud PO + **Director of Cloud** + **Director of Finance** | PO + TL                             |

For A3, both percentage and dollar conditions apply with minimum dollar floors as shown.

## Quarterly forecast policy

| Setting          | Business rule                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Horizon          | **24 months**, monthly granularity                                                                                                       |
| Review dates     | **1 Jan, 1 Apr, 1 Jul, 1 Oct**                                                                                                           |
| Required actions | Add months **13–24**; review/update **24-month forecast**; review **team members**; review **past 3 months spend**; complete **soft QR** |
| Sign-off         | **PO sign-off** required                                                                                                                 |
| Reminders        | **Weekly** until PO signs off                                                                                                            |
| Escalation       | If incomplete at **M+1** (one month after quarter start), escalate to **Director / ED**                                                  |
| Non-compliance   | Projects on compliance / escalation list; MoU allows **limited access** but Registry does not enforce it (manual ops)                    |

Initial forecast creation may still follow the [eMOU approval chain](../docs/business-logic/public-cloud/emou-workflow.md) for first-time products. **Ongoing quarterly accountability** uses **PO sign-off**, not director re-approval each quarter (unless policy changes).

## Monthly recap

| Setting     | Business rule                                                                  |
| ----------- | ------------------------------------------------------------------------------ |
| Schedule    | **1st of each month**                                                          |
| Format      | **Single bundled email** per recipient group                                   |
| Recipients  | **Cloud PO**, **Cloud Director**, **Finance Director**                         |
| Content     | Projects with open alerts, compliance gaps, escalations, significant variances |
| Always send | Yes — even when no alerts fired in the prior month                             |

## Accountability status rules

Statuses are derived from rule evaluation, not set manually.

| Status                   | Typical rule inputs                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Compliant                | Approved forecast exists; quarterly sign-off current; no open A2/A3 alerts                  |
| Forecast Required        | No approved forecast for active Project Set                                                 |
| Forecast Review Required | Quarterly update or PO sign-off overdue                                                     |
| Variance Review Required | Open A1+ alert without acknowledged response                                                |
| Escalated                | M+1 escalation fired or unresolved A3                                                       |
| Non-compliant            | On Public Cloud compliance / escalation list (visibility only; no automated limited access) |

Evaluation order (implemented in `recomputeAccountabilityState`):

1. Missing approved forecast → Forecast Required
2. Overdue quarterly review or unsigned PO sign-off → Forecast Review Required
3. Open unresolved alert at A2 or A3 → Variance Review Required or Escalated
4. On compliance escalation list → Non-compliant / Escalated
5. Otherwise → Compliant

## Reminder and escalation defaults

| Rule                        | Business default                              | Channel    |
| --------------------------- | --------------------------------------------- | ---------- |
| Quarterly forecast update   | On quarter start (Jan/Apr/Jul/Oct 1)          | CHES email |
| PO sign-off pending         | **Weekly** until complete                     | CHES email |
| Quarterly incomplete at M+1 | Escalate to Director / ED                     | CHES email |
| Open variance (A1+)         | Prompt PO/TL to update forecast + explanation | CHES email |
| Monthly recap               | 1st of month, bundled                         | CHES email |

## Projection methodology options

| Method                     | Description                                                  | MVP?                                      |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| Linear extrapolation       | `projected = spend_to_date / elapsed_fraction_of_month`      | Yes — same pattern as private cloud costs |
| Pace comparison            | `spend_to_date / forecast` vs `day_of_month / days_in_month` | Yes — for early pace warnings             |
| Flat run-rate              | Extrapolate using trailing 7-day average                     | Future                                    |
| Provider-reported forecast | Use cloud provider projection API when available             | Future                                    |

## Configuration UI (admin)

### Story RC.1 — View active rules

**As a** Public Cloud Administrator
**I want to** view the active rules configuration
**So that** I understand how accountability is evaluated.

### Story RC.2 — Update rules with versioning

**As a** Public Cloud Administrator
**I want to** update rules with version history
**So that** policy changes are traceable.

**Acceptance criteria**

-   Only authorized roles can edit: `managePublicCloudCostRules` (admin, public admin, billing reviewer, billing manager)
-   Changes create a new version; previous version retained
-   Effective date supported (optional scheduled activation)
-   Audit log: who changed what and when

### Story RC.3 — Preview rule evaluation

**As a** Public Cloud Administrator
**I want to** preview how rules apply to a sample Project Set
**So that** threshold changes can be validated before activation.

## Data model (rules)

Proposed MongoDB document shape (illustrative):

```text
CloudCostRulesConfig
  - id, version, effectiveAt, createdAt, createdById
  - varianceThresholds:
      a1: { percentAbove: 10 }
      a2: { percentAbove: 50, dollarsAbove: 500 }
      a3: { percentAbove: 200, minDollarsAbove: 500, dollarsAbove: 2000 }
  - consumptionMilestones: [50, 80, 100] + stepPercent: 25
  - earlyPaceWarning: { percentOfForecast: 50, byDayOfMonth: 10 }
  - forecastPolicy: { horizonMonths: 24, quarterStartMonths: [1,4,7,10] }
  - quarterlyReview: { softQrRequired: true, spendLookbackMonths: 3, poSignOffRequired: true }
  - reminderPolicy: { weeklyUntilSignOff: true, escalateAtMPlusOne: true }
  - monthlyRecap: { dayOfMonth: 1, recipients: [...] }
  - notificationRouting: { a1: {...}, a2: {...}, a3: {...} }
  - projectionMethod: enum
```

Only one config version should be **active** at a time. Historical evaluations should record which config version was used.

## Open policy decisions

-   [ ] **Notification routing** — map Cloud PO / Director of Cloud / Director of Finance (see below)
-   [ ] Confirm currency handling for dollar thresholds on Azure (CAD) vs AWS (USD) Project Sets
-   [x] MoU **limited access** — **out of scope** for Registry (manual ops if needed; no registry flag or provisioner integration)

### To be solved: admin and escalation notification routing

**Problem:** The governance whiteboard defines **platform-level recipients** who are not on the project team. The Registry must decide who receives admin variance alerts (A1–A3), M+1 quarterly escalations, and the monthly recap. Today this is **not configurable** on the cost-rules page (thresholds and schedules only).

**Business roles (whiteboard)**

| Role                    | Intended use                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| **Cloud PO**            | A2+ admin alerts; monthly recap                                                            |
| **Director of Cloud**   | A3 admin alerts; monthly recap; M+1 escalation visibility                                  |
| **Director of Finance** | A3 admin alerts; monthly recap                                                             |
| **Platform admin**      | A1+ admin alerts                                                                           |
| **Director / ED** (M+1) | Escalation when quarterly accountability is still incomplete one month after quarter start |

Project team recipients (PO, Technical Lead) are resolved from the product record — no policy gap there.

**Current implementation:** Configurable on `/admin/public-cloud/cost-rules` under **Notification routing**. Each scenario accepts comma-separated emails; when empty, Keycloak global roles are used (see interim mapping below).

| Email           | Cost-rules field       | Keycloak fallback (when field empty)                      |
| --------------- | ---------------------- | --------------------------------------------------------- |
| A1 admin        | `a1AdminEmails`        | `admin`, `public-admin`                                   |
| A2 admin        | `a2AdminEmails`        | above + `billing-reviewer` (proxy for Cloud PO)           |
| A3 admin        | `a3AdminEmails`        | above + `billing-manager` (proxy for directors / finance) |
| M+1 escalation  | `escalationEmails`     | `public-admin`, `billing-manager`, `billing-reviewer`     |
| Monthly recap   | `monthlyRecapEmails`   | `public-admin`, `billing-reviewer`, `billing-manager`     |
| Non-compliance  | `nonComplianceEmails`  | `public-admin`, `admin`                                   |
| Escalation list | `escalationListEmails` | `public-admin`, `admin`                                   |

Previously hardcoded in `app/services/ches/public-cloud/accountability-emails.ts` via Keycloak **global roles**:

`publicCloudTeamEmail` is CC’d in prod on several admin emails. `CloudCostRulesConfig` has **no** `notificationRouting` field in Prisma (only sketched in the data model section above).

**Gaps to resolve**

1. **Role mapping** — Do `billing-reviewer` / `billing-manager` / `public-admin` correctly represent Cloud PO, Director of Cloud, and Director of Finance for production?
2. **Roles vs mailing lists** — Should routing use Keycloak roles (IAM-owned), static CHES mailing lists, configurable emails on rules config, or a mix?
3. **Global vs org-scoped** — M+1 escalation text says **Director / ED** for the **project**; current code emails **global** billing/public-admin roles, not ministry or portfolio contacts from Registry org data.
4. **Where to configure** — Cost-rules page (versioned with thresholds), separate admin UI, env/constants only, or Keycloak-only with docs?
5. **Per-scenario routing** — Epic sketched `notificationRouting: { a1, a2, a3, escalation, monthlyRecap }`; confirm shape and whether recap is one bundled distro vs per-role emails.

**Decision needed from policy owners**

-   Confirm target recipients (people, roles, or lists) for each scenario in [email scenarios](./cloud-cost-email-scenarios.md).
-   Choose implementation approach and document in [Registry roles guide](../docs/business-logic/registry-roles-guide.md) once fixed.

**Suggested follow-up (engineering, after policy decision)**

-   Add `notificationRouting` to `CloudCostRulesConfig` **or** a dedicated notification settings surface.
-   Replace `getAdminAlertEmails` / `getDirectorEscalationEmails` / recap recipient logic with the agreed mapping.
-   Expose read-only “who receives what” on admin UI so ops can verify without reading code.

## Related documents

-   [Cloud Cost epic](./cloud-cost.md)
-   [Jira backlog mapping](./cloud-cost-jira-backlog.md)
-   [Cloud Cost data model](./cloud-cost-data-model.md)
-   [eMOU workflow](../docs/business-logic/public-cloud/emou-workflow.md)
-   [Registry roles guide](../docs/business-logic/registry-roles-guide.md)
