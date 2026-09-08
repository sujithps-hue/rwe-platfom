# Compliance model

The platform treats "which laws apply" as **data**, not code. Every tenant is assigned one or more
`Jurisdiction`s at provisioning time (derived from where the tenant operates and where its data subjects
are located); the compliance engine (`packages/compliance-engine`) resolves those jurisdictions to a set of
`ComplianceFramework` policies and enforces them on every request via the API's `ComplianceModule`.

This lets one codebase serve a US clinic, a German hospital group, a UAE provider, and a Singapore health
system without forking the product — only the tenant's jurisdiction configuration changes.

> **Important**: shipping this scaffolding is not the same as being certified. Read "What this repo does
> vs. what still requires human/legal work" at the bottom of this document before selling into a real
> jurisdiction.

## Framework matrix

| Region | Framework(s) | Key obligations enforced | Where in code |
|---|---|---|---|
| United States | **HIPAA** (Privacy, Security, Breach Notification Rules) + 42 CFR Part 2 (behavioral health) | BAA-gated onboarding; minimum-necessary access; Safe Harbor / Expert Determination de-identification; 6-year audit retention; 60-day breach notification; encryption at rest (AES-256) and in transit (TLS 1.2+) | `policies/hipaa.ts` |
| European Union / EEA / UK | **GDPR** (and UK GDPR) | Lawful basis + explicit consent capture; data subject rights (access, rectification, erasure, portability, restriction); 72-hour breach notification; DPIA requirement flag for large-scale health data processing; EU/EEA data residency; Standard Contractual Clauses flag for any cross-border transfer | `policies/gdpr.ts` |
| United Arab Emirates | **UAE PDPL** (Federal Decree-Law No. 45 of 2021) + DHA/DoH data-sharing rules where applicable | Consent-first processing of health data as "sensitive personal data"; in-country residency default; breach notification to UAE Data Office; DPO requirement above processing thresholds | `policies/uae_pdpl.ts` |
| Saudi Arabia | **Saudi PDPL** (SDAIA) | Similar shape to UAE PDPL; stricter default data-localization; explicit consent for sensitive data | `policies/ksa_pdpl.ts` |
| Singapore | **PDPA** | Consent/notification obligations; mandatory breach notification to PDPC when notifiable; reasonable security arrangements | `policies/pdpa_sg.ts` |
| China (PRC) | **PIPL** + Data Security Law | Separate/explicit consent for sensitive personal information (health data qualifies); data-localization + security-assessment requirement before any cross-border transfer | `policies/pipl_cn.ts` |
| India | **DPDP Act 2023** | Consent notice in specified form; breach notification to the Data Protection Board | `policies/dpdp_in.ts` |
| Global default | Baseline "reasonable security" policy | Applied when no specific jurisdiction is configured yet (e.g., a brand-new tenant mid-onboarding) — the most conservative subset of the above (audit logging on, consent required, no cross-border transfer without explicit approval) | `policies/baseline.ts` |

Each policy module implements the shared `CompliancePolicy` interface (`src/types.ts`) so the engine can
compose multiple frameworks for a tenant that spans regions (e.g., a US company with an EU subsidiary) by
taking the **most restrictive** value for every control (`engine.ts#mergePolicies`).

## What the engine actually enforces at runtime

1. **Data residency routing** (`engine.checkResidency`) — every tenant record carries a `homeRegion`
   (`us`, `eu`, `uae`, `ksa`, `sg`, `cn`, `in`, ...). Write paths in the API reject or reroute requests
   that would persist data outside the tenant's allowed region set, and the Terraform layout
   (`infra/terraform`) provisions one regional stack per residency zone so "in-region storage" is a
   deployment fact, not just an application-level promise.
2. **Consent gating** (`engine.checkConsent` / `ConsentService`) — before a connector ingests a patient
   record, or an analytics query includes an identifiable field, the engine checks the recorded
   `ConsentRecord` for that data subject against the framework's required consent type
   (`opt-in`, `notice-and-opt-out`, `granular-purpose`).
3. **De-identification** (`Deidentifier`) — implements HIPAA Safe Harbor's 18-identifier removal and a
   generic PII/PHI scrubber used as the default transform for any framework that doesn't specify a
   stricter standard, so cohort-level analytics can run on de-identified data even when full record-level
   access isn't authorized.
4. **Audit logging** (`AuditLogger`) — every read of identifiable health data, every export, every
   consent or connector change is written to an append-only audit log (`audit_log` table, insert-only DB
   role) with actor, tenant, jurisdiction, action, and record scope — sized to meet HIPAA's 6-year
   retention and GDPR's accountability principle simultaneously.
5. **Data-subject-rights workflows** (`ComplianceModule` in `apps/api`) — `POST /compliance/dsar` handles
   access/export/erasure requests, routes them by framework-specific SLA (GDPR: 30 days; UAE PDPL: without
   undue delay; CCPA-style if a US tenant opts in: 45 days), and produces a portable export in the DSAR's
   requested format.
6. **Breach notification clock** (`BreachClock`) — starting a breach workflow records the discovery
   timestamp and computes the correct notification deadline per applicable framework (72h GDPR, 60-day
   HIPAA, etc.), surfaced to the tenant's compliance dashboard.

## Extending to a new jurisdiction

1. Add a `Jurisdiction` enum value and a `policies/<code>.ts` implementing `CompliancePolicy`.
2. Register it in `policies/index.ts`.
3. Add a regional Terraform stack if the jurisdiction requires in-country data residency.
4. Add a row to the matrix above and to the tenant-provisioning UI's region picker.

## What this repo does vs. what still requires human/legal work

This scaffold gives you the **mechanism** (policy resolution, enforcement hooks, audit trail, consent and
DSAR workflows, regional deployment topology). It does **not** by itself make the operator HIPAA-compliant
or GDPR-compliant — that also requires, outside of code: signed Business Associate Agreements with every
sub-processor, a completed HIPAA Security Risk Assessment, GDPR Records of Processing Activities and (for
large-scale health data) a DPIA, a named EU representative/DPO where required, penetration testing and
SOC 2 Type II / HITRUST evidence, breach-response runbooks with legal counsel, and region-specific legal
review (UAE DoH/DHA data-sharing rules, KSA data localization licensing, China's cross-border security
assessment, etc.). Treat the checklist in `docs/ARCHITECTURE.md#compliance-readiness-checklist` as the
punch list before onboarding a real tenant with real patient data in a given region.
