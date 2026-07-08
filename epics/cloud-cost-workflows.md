# Cloud Cost Workflows

Process diagrams for the [Cloud Cost Accountability epic](./cloud-cost.md). CSP spend ingest is assumed; see [data shapes](./cloud-cost-data-model.md#csp-data-contract).

## 1. Initial forecast lifecycle

First-time forecast for a Project Set (often aligned with product create or first quarter after provisioning).

```mermaid
flowchart TB
    A((PO / TL opens Forecast page))
    A --> B[Create 24-month monthly forecast]
    B --> C{Save or submit?}
    C -->|Save draft| D[Status: DRAFT]
    D --> B
    C -->|Submit| E[Status: PENDING_APPROVAL]
    E --> F[Notify billing-reviewer]
    F --> G{Director review}
    G -->|Approve| H[Status: APPROVED — active forecast]
    G -->|Reject| I[Status: REJECTED + reason]
    I --> B
    H --> J[CSP uses approved values as currentMonthForecast]
```

Initial approval follows the same approver role as eMOU director review (`billing-reviewer`). See [eMOU workflow](../docs/business-logic/public-cloud/emou-workflow.md).

**Implementation note:** Approve, reject (Story 1.5), and Scenario 10 `ForecastSubmitted` email are **implemented**. See [Jira backlog mapping](./cloud-cost-jira-backlog.md).

## 2. Quarterly forecast update (1 Jan / Apr / Jul / Oct)

```mermaid
flowchart TB
    Q((Quarter start))
    Q --> R[CHES: quarterly update reminder to PO / TL]
    R --> U[PO extends months 13–24]
    U --> V[PO reviews / updates 24-month forecast]
    V --> W[PO reviews team members]
    W --> X[PO reviews past 3 months spend]
    X --> Y[Soft quarterly review]
    Y --> Z{PO sign-off?}
    Z -->|Yes| OK[Quarterly review COMPLETE]
    Z -->|No| Wk[Weekly reminder emails]
    Wk --> Z
    Wk -->|Still unsigned at M+1| Esc[Escalate Director / ED]
    Esc --> NC[Compliance / escalation list]
```

## 3. CSP consumption and alerts

```mermaid
flowchart LR
    CSP[CSP sends CspConsumptionSnapshot]
    CSP --> REG[Registry upserts CloudSpendSnapshot]
    CSP2[CSP sends CspConsumptionAlert]
    CSP2 --> AL[Registry creates AccountabilityAlert]
    AL --> N{Notification routing}
    N --> P[Email PO + TL]
    N --> A[Email admin cohort by level]
    P --> R{Owner response?}
    R -->|Acknowledge| Ack[ACKNOWLEDGED]
    R -->|Explain + resolve| Res[RESOLVED]
    R -->|Update forecast| FC[New forecast version]
```

Alert levels and recipients: [rules configuration](./cloud-cost-rules-config.md).

## 4. Variance response

```mermaid
flowchart TB
    A((Open alert on product Accountability tab))
    A --> B{Owner action}
    B -->|Acknowledge| C[Record user + timestamp]
    B -->|Explain variance| D[Save explanation on alert]
    B -->|Resolve| E[Resolution reason + date]
    D --> F{Forecast update needed?}
    F -->|Yes| G[Edit forecast → new version]
    G --> H[Link forecast revision to alert]
    E --> I[Re-evaluate accountability status]
    C --> I
```

## 5. Monthly admin recap (1st of month)

```mermaid
flowchart LR
    T((1st of month scheduler))
    T --> B[Build bundled project list]
    B --> E1[Email Cloud PO]
    B --> E2[Email Cloud Director]
    B --> E3[Email Finance Director]
```

Content: open alerts, compliance gaps, escalations, significant variances — sent even if no alerts fired.

## Related documents

-   [Cloud Cost epic](./cloud-cost.md)
-   [Email scenarios](./cloud-cost-email-scenarios.md)
-   [UI specification](./cloud-cost-ui.md)
