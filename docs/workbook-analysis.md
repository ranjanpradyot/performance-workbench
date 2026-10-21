# Workbook analysis

Inspected on 19 October 2026 with openpyxl 3.1.5. The files were read only. Nothing in the source workbooks was edited.

| Workbook | Sheets | Formulas |
| --- | ---: | ---: |
| Utkarsh_OKR_Checklist_Linked_0.3.xlsx | 26 | 10, all on KPI_2025 and KPI_2026 |
| Krishna_OKR_Checklist_Linked_v0.2.xlsx | 25 | 0 |
| Santosh_OKR_Checklist_Linked_0.3.xlsx | 28 | 11, on KPI_2025 and KPI_2026 |

Santosh was supplied with the other two files and is included. The three workbooks are not the same profile.

## Sheet order

### Utkarsh

Document_Summary, KPI_2025, KPI_2026, OKR_Summary, OKR_Checklist_Summary, Utkarsh_OKR_Checklist, Actual_vs_Achieved_Scorecard, Learning_Evidence, Ticket_Velocity, Ticket_Spillover, FirstCut_Quality, CodeChange_Summary, CodeChange_Tickets, Helpdesk_Discipline, SLA_CycleDays, Customer_Defect_Themes, Rework_Reopen_Proxy, Tickets_Master_Utkarsh, then Q3-2025, Q4-2025, Q1-2026, and Q2-2026 ticket and ticket-summary pairs.

### Krishna

Same family, without Document_Summary. Checklist sheet is Krishna_OKR_Checklist. Master sheet is Tickets_Master_Krishna. Learning_Evidence sits before Ticket_Velocity. No Q2-2025 sheets. The master still contains Q3-2026 tickets, and Ticket_Velocity has an out-of-scope Q3-2026 row.

### Santosh

Document_Summary through Rework_Reopen_Proxy, then Learning_Evidence (after rework, not before velocity), Tickets_Master_Santosh, then Q2-2025, Q3-2025, Q4-2025, Q1-2026, and Q2-2026 ticket pairs. The master also contains Q4-2024, Q1-2025, and Q3-2026 rows that do not all have their own sheets.

## People, taken only from the sheets

| Person | Employee ID | Title | Manager | Score model |
| --- | --- | --- | --- | --- |
| Utkarsh | 1775 | SSE | blank | Scoped. Annual weight / 4 × 2 on the KPI sheet. Quarter weight = annual / 4. |
| Krishna | blank | TSE | blank | Full annual weight on the scorecard for each quarter. v0.2, not the later /4 rule. |
| Santosh | blank | LE | Kiran Sangem, from the RM column | Same scoped rule as Utkarsh. Extra 2026 KPI: Growth. |

No employee IDs were invented for Krishna or Santosh.

## Score rules that must not be merged

Utkarsh 0.3 and Santosh 0.3 say: a KPI marked Yes gets the full quarter weight (annual / 4). No gets 0. Partial checklist lines are not the KPI score. Each in-scope quarter is out of 25. Two quarters make 50. The two years make an expected 100.

Utkarsh weights: 2025 Project Delivery 58, Process Adherance 12, External Bug Count, Ticket Reopen 16, Self Learning 14. 2026 Execution 30, Quality 50, Learning & Development 20.

Santosh weights: 2025 Project Delivery 50, Process Adherance 15, External Bug Count, Ticket Reopen 20, Self Learning 15. 2026 Execution 29, Quality 50, L&D 20, Growth 1.

Krishna 0.2 stores the full annual numbers on KPI_2025 and KPI_2026 and shows each quarter as 100. The scorecard awards 58/12/16/14 in 2025 and 30/50/20 in 2026. The OKR checklist for 2026 uses line weights 5, 5, and 5, and the checklist summary totals 20 per 2026 quarter and 240 overall. Both presentations are kept. The dashboard KPI points follow the scorecard weight. Checklist completion follows the checklist lines. They are not forced to match.

Santosh Execution is No for Q1-2026 (4 closed, target 9) and Q2-2026 (6 closed, target 12). Growth is No. Recorded 2026 achievement is 35, total 85. Utkarsh recorded total is 100. Krishna scorecard quarters are 100, while the checklist grand total is 240.

Source spelling Process Adherance is kept on export. The screen can say Process Adherence beside it.

## KPI sheet fields

KPI_2025 header, in order: KPI, EmployeeID, EmployeeName, Weightage, Year, Q3Target, Q3Actual, Q3Achieved, OKR Link, Q4Target, Q4Actual, Q4Achieved, OKR Link, Title. Santosh adds RM.

KPI_2026 header, in order: KPI, EmployeeID, EmployeeName, Weightage, Year, then Q1 through Q4 blocks of Target, Actual, Achieved, OKR Link.

Utkarsh formulas, cached values confirmed:

- KPI_2025 D2 `=58/4*2` → 29, D3 `=12/4*2` → 6, D4 `=16/4*2` → 8, D5 `=14/4*2` → 7, B7 `=SUM(D2:D5)` → 50.
- KPI_2026 D2 `=30/4*2` → 15, D3 `=50/4*2` → 25, D4 `=20/4*2` → 10, B6 `=SUM(D2:D4)` → 50, B8 `=KPI_2025!B8+B7` → 100.

Santosh formulas: `=50/4*2`, `=15/4*2`, `=20/4*2`, `=15/4*2`, and for 2026 `=29/4*2`, `=50/4*2`, `=20/4*2`, `=1/4*2`. Total formula `=KPI_2025!B8+B8` caches 85.

Krishna weight cells are literals. There is a Quarterly Score row (100) instead of the 2-quarter sum block. Q3 and Q4 2026 target text is present and actuals are blank. Those quarters stay unassessed. They are not zeroes.

OKR Link cells are internal hyperlinks such as `Utkarsh_OKR_Checklist!A2`. Several future-quarter links point at `A1` and are placeholders.

## Checklist fields

Header, same on all three, row 1: Employee Name, Quarter, KPI Affected, OKR Met?, Weightage, Artifacts to OKR, Other Links, OKRs, Deliverable Expected, Evidence Note.

Utkarsh has 29 lines, Krishna 16, Santosh 20. Line weights are not equal. Utkarsh Q3 Project Delivery is split 8.5 + 3 + 3. Krishna 2025 uses one line per KPI at the full annual weight. A line is not achieved just because the text is long. OKR Met? is the recorded status.

Artifacts are internal sheet links or URLs. A workbook-only link is kept and described as a sheet reference. External links, including the timesheet URL and Bitbucket paths, are kept as links.

## Learning evidence

Utkarsh and Krishna use ten columns: Quarter, KPI, POC / Focus Area, Problem Statement, Acceptance Criteria, Tech Stack, Evidence Link / Path, Achieved/Not Achieved, Primary Deliverable or Primary Deliverable / Outcome, Comments.

Santosh uses six columns: Quarter, KPI, POC / Course, Evidence Link / Path, Yes/No. Problem statement, acceptance criteria, tech stack, primary deliverable, and comments are absent and stay empty rather than being invented. Q3-2026 and Q4-2026 rows have no Yes/No and stay not assessed.

## Ticket master

Header, row 5 on the master sheets: Ticket No., Description, Status, Month, Assign Date, Closure Date, Owner, SP Change, Code Change, Code Lines Changed, SQL Lines Changed, Quarter, Cycle Days.

CodeChange_Tickets adds Azure_PR_URL (manual). Those URLs are mostly blank and are stored on the same ticket, not as a second ticket.

Krishna ticket 32233 appears twice: once In Progress in Q1-2026 and once Closed in Q3-2026, with different dates and line counts. Both rows are kept. The repeated number is a warning, not a reason to drop a row.

Closed statuses in the files are Closed, Resolved, and RESOLVED. Open examples include InProgress, OnHold, In-UAT, and InProgress - Approver. A blank status is not closed and is not zero.

The Quarter column is authoritative for historical rows. The sheet note says it was derived from Closure Date, else Month, else Assign Date. New tickets use that same order. The application does not silently move an imported ticket to a different quarter.

Blank code or SQL lines stay blank. A stored 0 stays 0. Santosh Q1-2026 has explicit zero code-change counts.

Cycle days on closed tickets match Assign Date to Closure Date in whole days. Example: Utkarsh 18851, 2026-02-11 to 2026-03-18, cycle 35.

## Derived sheets

These are views of the master plus recorded assessments. Export rebuilds them. The original Yes/No is kept when it disagrees with a later calculation.

| Sheet | Header | Rule written on the sheet |
| --- | --- | --- |
| Ticket_Velocity | Quarter, Total Tickets, Closed/Resolved, Open, Target, Yes/No, Comments, Source | Yes if closed >= target or closed >= 70% of target, using the floor. Utkarsh target is 9. Krishna targets are Q3-2025 8, Q4-2025 3, Q1-2026 8, Q2-2026 12. Santosh 2025 target is 9. Santosh 2026 targets are Q1 9, Q2 12, Q3 15, Q4 18. An em dash target is not zero and is out of appraisal scope. |
| Ticket_Spillover | Quarter, Total, Open (spill), Spill %, Achieved/Not Achieved, Open Ticket Nos., Comments | Achieved if open <= 2 or spill % <= 20. The two conditions are OR. Two open tickets can be Yes even when spill % is high. No Jira spill field. |
| FirstCut_Quality | Quarter, Code/SP Tickets, Closed Code/SP, Code Lines, SQL Lines, Achieved/Not Achieved, Comments | Proxy for missing Jira first-cut data. A line count does not by itself mean achieved. |
| CodeChange_Summary | Quarter, Code Change Tickets, SP Change Tickets, Code Lines, SQL Lines, Achieved/Not Achieved, Comments. Utkarsh and Santosh also have PR Rejection % and PR Rejection Achieved. Krishna does not. | PR rejection threshold is under 10% where that column exists. Krishna states that PR rejection cannot be pulled and uses code/SP lines as the auditable proxy. |
| SLA_CycleDays | Quarter, Closed, Avg Cycle Days, Max Cycle Days, Achieved/Not Achieved, Comments | Proxy. Target average <= 45. Santosh rows are marked Yes even where the average is far above 45 (Q1-2026 average 142.5). The recorded Yes is kept and the calculation is shown separately. |
| Customer_Defect_Themes | Quarter, Closed, Defect-like Themes, Yes/No or Achieved/Not Achieved, Ticket Nos., Comments, then a ticket-level Defect-like? table | Threshold <= 4. The Defect-like? flag is curated. It does not consistently match keywords such as duplicate or missing. Utkarsh comments sometimes say client-reported defects = 0 while the theme proxy is 2. Both facts are kept. |
| Rework_Reopen_Proxy | Quarter, Tickets, Rework Proxy Count, Rate %, Yes/No or Achieved/Not Achieved, Ticket Nos. | Utkarsh and Santosh: keywords only. OnHold, In-UAT, and Approver are wait states and are not rework. Krishna's note includes those wait states or keywords, with a rate threshold of 20%. Utkarsh and Santosh scorecards use Rework < 5%. There is no reopen column in Helpdesk. |
| Helpdesk_Discipline | Checklist items, a quarterly Yes/No/N/A matrix, and ticket hygiene | Process adherence target is >= 90%. CAB, timesheet, and PR approval are manager-confirmed, not proved by the ticket export. Krishna Q3-2025 matrix cells are N/A, not Yes and not a miss. Santosh inserts a Process Item column. |

Quarter ticket sheets repeat the master header for one quarter. Quarter summary metrics are Total tickets, Closed/Resolved, Open / spill, Spill %, Code Change tickets, SP Change tickets, Code Lines, SQL Lines, Avg Cycle Days, Defect-theme proxy, Rework/reopen proxy, Quality gate.

## Scorecard fields

Utkarsh: Quarter, KPI Area, Metric, Target, Actual, Yes, Weightage (KPI), Evidence Sheet, Source KPI Target (short), Validation Notes.

Santosh header uses Yes/No and Notes. Validation text also sits in the following column and is preserved.

Krishna uses the Utkarsh-style header and full annual weights. Q3-2025 Project Delivery actual is 0 and status is Yes, with the note that this was training / KT and a PM Yes.

## Known source inconsistencies

- Utkarsh Ticket_Velocity footer SQL lines (917 all master, 882 appraisal) do not match the scorecard footer (973). Ticket line items are the source. Summaries are summed from those lines on export.
- Krishna 2026 checklist weights and scorecard weights describe different totals. Both are stored.
- Santosh SLA Yes values do not follow the 45-day sentence in the same sheet.
- Defect comments and defect-theme counts are not always the same claim.
- Some OKR links for quarters that have no checklist lines point at cell A1.
- No formula errors were cached as Excel error values on the KPI formulas. The cached results matched the arithmetic above.

## Application mapping

| Workbook region | Canonical record |
| --- | --- |
| KPI row | KpiDefinition, plus one KpiAssessment per populated quarter |
| Checklist row | OkrChecklistEntry. The OKR text is the key result. The KPI is the objective grouping. |
| Ticket master row | Ticket. Quarter sheets and code-change sheets are views. |
| Defect-like? | Ticket.defectLike. Null means the flag was not on a detail row. |
| Learning row | LearningEvidence |
| Helpdesk checklist and matrix | ProcessAssessment |
| Metric sheet row | MetricSnapshot, used as the recorded assessment and comment |
| Scorecard row | ScorecardLine, and the weight used for KPI points |
| Document summary | DocumentNote |
| Sheet title and note | SheetNarrative, copied onto export |
| Threshold notes | AssessmentRuleSet, versioned per reportee |

Empty cells are stored as empty, not as zero and not dropped. Unknown header columns, if a future workbook adds them, go to the record extension map.

## Ambiguities left configurable

1. Whether a manager wants Krishna-style full-year points or the v0.3 quarter weight. Each reportee keeps the model found in that file. New reportees default to the v0.3 scoped rule.
2. Whether defect comments or the curated Defect-like? count is the external-bug number. The threshold uses the curated count. The comment is unchanged.
3. Whether SLA achievement should be recalculated when the average exceeds 45. The import keeps the recorded status until someone overrides it with a reason.
4. Quarter status for the imported appraisal window is Under Review, not Finalized. Finalizing is an explicit action.
