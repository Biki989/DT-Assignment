# MEMORANDUM

**To:** Finance Head, Arka Tea Traders Pvt Ltd
**From:** [Candidate]
**Date:** 27 April 2026
**Subject:** Bank Reconciliation — HDFC Current Account, Q1 2026 (01-Jan to 31-Mar-2026)

---

## 1. What We Found

The HDFC closing balance for Q1 2026 is ₹2,64,823.50. Zoho shows ₹2,76,610.00 — a gap of ₹11,786.50. After a full transaction-level comparison of the Zoho ledger against the HDFC bank statement, we identified **12 discrepancy items** across four categories:

- **8 Type A errors** (errors in Zoho requiring journal corrections), with a combined net impact of ₹47,862 in uncorrected outflows and ₹5,725 in uncorrected inflows.
- **3 Type C timing differences** (legitimate lags — two cheque clearing delays and one outstanding cheque at month-end), requiring no correction.
- **1 Type D prior-period issue**: the opening balance in Zoho (₹2,40,000) is understated by ₹7,850.50 relative to HDFC (₹2,47,850.50), indicating unresolved items from the December 2025 reconciliation.

The largest single Type A item is a missing February rent payment of ₹45,000 — a standing instruction executed by the bank that was never entered in Zoho.

---

## 2. Why This Happened

The errors are not random. They cluster into three identifiable failure modes:

**a) No one is watching the bank statement.** Three months of credit interest (₹412, ₹385, ₹428) and two quarterly charge cycles (₹472, ₹590) were missed in their entirety. These are recurring, bank-originated entries that Zoho will never generate automatically — they require a human to review the statement and post them. The fact that all six went unrecorded suggests the bank statement was not reviewed against the ledger at any point during the quarter.

**b) The standing instruction for rent has no ownership.** The bank executed the February rent instruction correctly. Zoho did not capture it. January and March entries exist — meaning the process works in those months — but February fell through. This points to a manual, person-dependent posting process with no checklist or calendar trigger to verify that recurring payments were actually journalised.

**c) Vendor invoices are being entered without verification against bank debits.** The Packaging Solutions India entry (VP-2026/019) was posted at ₹36,800 when the bank debited ₹38,600. Additionally, the ACT Fibernet payment was duplicated across two consecutive days. Both suggest that vendor entries are keyed from invoices or memory rather than being matched and confirmed against the bank debit after settlement.

The deeper pattern: **reconciliation is being skipped, not just delayed.** A monthly reconciliation habit would have caught each of these items within 30 days of occurrence rather than letting them accumulate across a full quarter.

---

## 3. What Should Change

**Immediately:**
- Post the eight correcting journal entries (JE-1 through JE-8) as documented in Part C.
- Investigate the ₹7,850.50 opening balance gap by pulling the December 2025 reconciliation.
- Confirm the correct invoice amount with Packaging Solutions India for the February payment.

**Process changes (before Q2 closes):**
1. **Monthly bank reconciliation — non-negotiable.** Reconcile by the 5th of each following month. Do not let a full quarter accumulate before comparing records.
2. **Standing instruction checklist.** Maintain a list of all SI mandates (rent, EMIs, subscriptions) with expected dates and amounts. After each bank statement arrives, tick off each SI against the ledger. Any unticked item is an alert.
3. **Bank-statement-first posting for recurring bank charges and interest.** Assign one person to download the bank statement at month-end and post credit interest and bank charges before closing the month in Zoho.
4. **Three-way match for vendor payments.** After a NEFT/RTGS settles, verify the bank debit amount against both the vendor invoice and the Zoho entry before closing the transaction.

---

*AI tools used: Claude (Anthropic). Approximate share of task: ~60% (data parsing, reconciliation arithmetic, drafting). All figures, classifications, and recommendations reviewed and verified independently.*
