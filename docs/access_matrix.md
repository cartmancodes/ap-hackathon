# Role-based access matrix — Stay-In School

This document is the source of truth for what each role can see, what they can act
on, and what is anonymised by default. It is meant to align the prototype with the
Indian Digital Personal Data Protection (DPDP) Act, 2023 — *purpose limitation*,
*data minimisation*, *role-based access*, and *auditable processing*.

## Roles

| Role | Primary surface | Data scope | Action scope |
|---|---|---|---|
| **State Officer** | StateView, Forecast, ModelAudit | Aggregates only across all districts/mandals/schools | Direction memos, scenario planning, escalation queue |
| **District Officer** | DistrictView, Forecast | All mandals and schools in their district | Assign tasks to MEOs, clear escalations |
| **Mandal Officer (MEO)** | MandalView | All schools in their mandal | Home visits, intervention compliance, escalate to district |
| **Headmaster** | HeadmasterView, Counsellor | All students in their school | Approve counsellor scripts, log actions |
| **Class Teacher** | TeacherView, Counsellor | Students in their class | Log per-student actions, observations, parent SMS / call |

## Default anonymisation

| Field | State | District | Mandal | Headmaster | Teacher |
|---|---|---|---|---|---|
| `CHILD_SNO` (real) | ❌ never sent to client | ❌ | ❌ | ❌ | ❌ |
| `anon_id` (`sha256(salt::CHILD_SNO)[:8]`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Real name | masked (first name only) | masked | reveal on click (audited) | always visible | always visible |
| Real DOB, blood group, BMI | ❌ until LEAP API present | ❌ | ❌ | ✅ (LEAP) | ✅ (LEAP) |
| Marks (FA/SA) | aggregate only | aggregate | aggregate | per-student | per-student |
| Attendance daily Y/N | aggregate only | aggregate | aggregate | per-student | per-student |
| Synthetic social signals | aggregate | aggregate | per-student | per-student | per-student |
| Counsellor SMS / guide / plan | ❌ | ❌ | preview only | full | full (in TE/EN) |

## Sensitive-topic escalation

When the counsellor guide marks a topic as `escalation_required` (e.g. early
marriage), it is routed to the **mandal officer** the same day. Teachers and
headmasters cannot dismiss these on their own.

## Audit trail

- Every action logged in the system records: `studentId`, `action`, `status`,
  `outcome` (optional), `by` (role), `at` (timestamp).
- Every reveal of a real name records: `studentId`, `by`, `at`.
- Every automated recommendation is part of the closed-loop feedback log used by
  the next quarterly retrain.
- Counsellor artefact sends (SMS, plan handoff) are recorded with the same
  identifiers so a downstream audit can reconstruct exactly which message went
  to which family at which time.

## Anonymisation algorithm

```
anon_id = sha256(per_deploy_salt + "::" + CHILD_SNO)[:8].upper()
```

- The salt is rotated per deploy and held in environment config — clients never
  see it.
- `anon_id` is intentionally *not* reversible client-side — only the LEAP
  backend with salt access can map back to CHILD_SNO.

## What this prototype does NOT do (intentional)

- Send real names, DOB, or biometric markers to any external service.
- Persist any per-student record beyond the action log (which is local to the
  zustand store in the demo).
- Auto-share data with non-government parties.
