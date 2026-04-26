"""
Bank Reconciliation Decision Tree
Arka Tea Traders Pvt Ltd — HDFC Current Account — Q1 2026
Deterministic rule-based classifier for transaction discrepancies.
"""

import csv
import json
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime


# ─────────────────────────────────────────────────────────────
# Data model
# ─────────────────────────────────────────────────────────────

@dataclass
class Transaction:
    date: str
    description: str
    zoho_amount: Optional[float]        # None if not in Zoho
    bank_amount: Optional[float]        # None if not in Bank
    is_cheque: bool = False
    is_bank_generated: bool = False     # interest, charges, fees
    is_standing_instruction: bool = False
    is_prior_period: bool = False
    date_diff_days: int = 0             # abs diff between Zoho date and bank date
    is_bank_error: bool = False         # confirmed error on bank's side


@dataclass
class Classification:
    type: str           # Type A / B / C / D / Match / Note
    label: str
    action: str
    path: list = field(default_factory=list)   # decision steps taken


# ─────────────────────────────────────────────────────────────
# Type registry (for reporting)
# ─────────────────────────────────────────────────────────────

TYPE_META = {
    "Type A": {
        "title": "Error / Missing Entry",
        "desc":  "Entry present in one system only (excluding timing differences) or amounts differ due to a posting error.",
        "urgent": True,
    },
    "Type B": {
        "title": "Bank Error",
        "desc":  "Amount credited/debited incorrectly by the bank. Raise formal dispute; do NOT adjust books.",
        "urgent": True,
    },
    "Type C": {
        "title": "Timing Difference",
        "desc":  "Entry exists in both systems but clearance lags across the period-end. Disclose in BRS.",
        "urgent": False,
    },
    "Type D": {
        "title": "Prior-Period / Opening Balance",
        "desc":  "Discrepancy originates before the current quarter. Investigate and post prior-period adjustment.",
        "urgent": True,
    },
    "Match": {
        "title": "Matched",
        "desc":  "Transaction matches in both amount and date. No action required.",
        "urgent": False,
    },
    "Note": {
        "title": "Data Issue",
        "desc":  "Transaction absent from both systems. Likely an extraction/import error.",
        "urgent": False,
    },
}


# ─────────────────────────────────────────────────────────────
# The decision tree
# ─────────────────────────────────────────────────────────────

def classify(tx: Transaction) -> Classification:
    """
    Deterministic decision tree.
    Returns a Classification with type, label, recommended action,
    and the exact path of decisions taken.
    """
    path = []

    in_bank = tx.bank_amount is not None
    in_zoho = tx.zoho_amount is not None

    # ── Branch 1: In bank only ─────────────────────────────────
    if in_bank and not in_zoho:
        path.append("In bank: YES")
        path.append("In Zoho: NO")

        if tx.is_prior_period:
            path.append("Prior-period item: YES")
            return Classification(
                type="Type D",
                label="Prior-period / opening balance issue",
                action=(
                    "Investigate prior quarter. Post prior-period adjustment journal "
                    "to align Zoho opening balance."
                ),
                path=path,
            )
        path.append("Prior-period item: NO")

        if tx.is_bank_generated:
            path.append("Bank-generated entry (interest/charges): YES")
            return Classification(
                type="Type A",
                label="Missing bank-originated entry in Zoho",
                action=(
                    "Dr/Cr HDFC Current A/c ↔ Cr/Dr Interest Income or "
                    "Bank Charges Expense."
                ),
                path=path,
            )
        path.append("Bank-generated entry: NO")

        if tx.is_standing_instruction:
            path.append("Recurring standing instruction: YES")
            return Classification(
                type="Type A",
                label="Missing standing instruction entry in Zoho",
                action=(
                    "Post missing journal entry. "
                    "Add SI to monthly verification checklist."
                ),
                path=path,
            )
        path.append("Recurring standing instruction: NO")

        return Classification(
            type="Type A",
            label="Missing entry in Zoho",
            action="Identify transaction nature and post missing journal entry in Zoho.",
            path=path,
        )

    # ── Branch 2: In Zoho only ────────────────────────────────
    if in_zoho and not in_bank:
        path.append("In bank: NO")
        path.append("In Zoho: YES")

        if tx.is_cheque and tx.date_diff_days <= 5:
            path.append("Cheque/deposit near period-end: YES")
            return Classification(
                type="Type C",
                label="Outstanding / uncleared item",
                action=(
                    "Disclose as outstanding item in BRS. "
                    "Verify clearance in next statement."
                ),
                path=path,
            )
        path.append("Cheque/deposit near period-end: NO")

        if "duplicate" in tx.description.lower():
            path.append("Possible duplicate entry: YES")
            return Classification(
                type="Type A",
                label="Duplicate entry in Zoho",
                action=(
                    "Reverse/delete duplicate entry. "
                    "Verify original entry is correct before reversing."
                ),
                path=path,
            )
        path.append("Possible duplicate entry: NO")

        return Classification(
            type="Type A",
            label="Phantom entry in Zoho",
            action=(
                "Investigate who posted the entry. "
                "If erroneous, reverse with a contra journal."
            ),
            path=path,
        )

    # ── Branch 3: In both ─────────────────────────────────────
    if in_bank and in_zoho:
        path.append("In bank: YES")
        path.append("In Zoho: YES")

        if tx.is_prior_period:
            path.append("Prior-period item: YES")
            diff = round(abs(tx.bank_amount - tx.zoho_amount), 2)
            return Classification(
                type="Type D",
                label=f"Opening balance mismatch (diff: ₹{diff:,.2f})",
                action=(
                    "Reconcile prior-quarter closing balance. "
                    "Post prior-period adjustment journal to correct Zoho opening balance."
                ),
                path=path,
            )
        path.append("Prior-period item: NO")

        amounts_match = abs(tx.bank_amount - tx.zoho_amount) < 0.01

        if amounts_match:
            path.append("Amounts match: YES")

            if tx.date_diff_days <= 3:
                path.append("Dates match (within 3 days): YES")
                return Classification(
                    type="Match",
                    label="No discrepancy",
                    action="None required.",
                    path=path,
                )
            path.append("Dates match: NO")

            if tx.is_cheque:
                path.append("Cheque / clearing item: YES")
                return Classification(
                    type="Type C",
                    label="Timing difference – clearing lag",
                    action=(
                        "Disclose in BRS. No journal entry needed. "
                        "Monitor next statement."
                    ),
                    path=path,
                )
            path.append("Cheque / clearing item: NO")

            return Classification(
                type="Type A",
                label="Wrong date in Zoho",
                action=(
                    "Correct the transaction date in Zoho "
                    "to match the bank value date."
                ),
                path=path,
            )

        path.append("Amounts match: NO")
        diff = round(abs(tx.bank_amount - tx.zoho_amount), 2)

        if tx.is_bank_error:
            path.append("Confirmed bank error: YES")
            return Classification(
                type="Type B",
                label="Bank error",
                action=(
                    "Raise formal dispute with HDFC. "
                    "Do not adjust Zoho — await bank correction letter."
                ),
                path=path,
            )
        path.append("Confirmed bank error: NO")

        return Classification(
            type="Type A",
            label=f"Wrong amount in Zoho (diff: ₹{diff:,.2f})",
            action=(
                "Correct amount in Zoho to match bank debit/credit. "
                "Verify against original invoice/contract."
            ),
            path=path,
        )

    # ── Neither ───────────────────────────────────────────────
    path.append("In bank: NO")
    path.append("In Zoho: NO")
    return Classification(
        type="Note",
        label="Not in either system",
        action="Re-examine source data. Likely a data extraction / import issue.",
        path=path,
    )


# ─────────────────────────────────────────────────────────────
# Q1 2026 — Arka Tea Traders discrepancies
# ─────────────────────────────────────────────────────────────

DISCREPANCIES: list[Transaction] = [
    Transaction("01/01/2026", "Opening Balance",
                zoho_amount=240000.00, bank_amount=247850.50,
                is_prior_period=True),

    Transaction("21/01/2026", "ACT Fibernet – Duplicate Payment (VP-2026/009)",
                zoho_amount=4500.00, bank_amount=None),

    Transaction("31/01/2026", "Credit Interest – January 2026",
                zoho_amount=None, bank_amount=412.00,
                is_bank_generated=True),

    Transaction("31/01/2026", "Bank Charges – QTR Maintenance + GST (Jan)",
                zoho_amount=None, bank_amount=472.00,
                is_bank_generated=True),

    Transaction("11/01/2026", "Mahadev Provisions – Cheque Deposit",
                zoho_amount=42600.00, bank_amount=42600.00,
                is_cheque=True, date_diff_days=3),

    Transaction("05/02/2026", "Office Rent – Ravi Menon (February SI)",
                zoho_amount=None, bank_amount=45000.00,
                is_standing_instruction=True),

    Transaction("17/02/2026", "Packaging Solutions India – NEFT",
                zoho_amount=36800.00, bank_amount=38600.00),

    Transaction("28/02/2026", "Credit Interest – February 2026",
                zoho_amount=None, bank_amount=385.00,
                is_bank_generated=True),

    Transaction("22/02/2026", "Monsoon Hotels – Cheque Deposit",
                zoho_amount=215300.00, bank_amount=215300.00,
                is_cheque=True, date_diff_days=2),

    Transaction("28/03/2026", "Darjeeling Highland Tea – Cheque Issued",
                zoho_amount=22500.00, bank_amount=None,
                is_cheque=True, date_diff_days=3),

    Transaction("31/03/2026", "Credit Interest – March 2026",
                zoho_amount=None, bank_amount=428.00,
                is_bank_generated=True),

    Transaction("31/03/2026", "Bank Charges – QTR Maintenance + GST (Mar)",
                zoho_amount=None, bank_amount=590.00,
                is_bank_generated=True),
]


# ─────────────────────────────────────────────────────────────
# Console runner
# ─────────────────────────────────────────────────────────────

TYPE_COLORS = {
    "Type A": "\033[91m",   # red
    "Type B": "\033[95m",   # magenta
    "Type C": "\033[93m",   # yellow
    "Type D": "\033[96m",   # cyan
    "Match":  "\033[92m",   # green
    "Note":   "\033[90m",   # grey
}
RESET = "\033[0m"
BOLD  = "\033[1m"


def run_all() -> list[dict]:
    """Classify all discrepancies, print to console, return results."""
    print(f"\n{BOLD}{'─'*72}{RESET}")
    print(f"{BOLD}  ARKA TEA TRADERS — BANK RECON DECISION TREE — Q1 2026{RESET}")
    print(f"{BOLD}{'─'*72}{RESET}\n")

    summary = {t: 0 for t in TYPE_META}
    results = []

    for i, tx in enumerate(DISCREPANCIES, 1):
        result = classify(tx)
        col    = TYPE_COLORS.get(result.type, "")

        print(f"  {BOLD}#{i:02d}  {tx.date}  —  {tx.description}{RESET}")
        print(f"  {col}  [{result.type}]  {result.label}{RESET}")
        print(f"  Decision path:")
        for step in result.path:
            print(f"    → {step}")
        print(f"  Action: {result.action}")
        print()

        summary[result.type] = summary.get(result.type, 0) + 1
        results.append({
            "index": i,
            "tx": tx,
            "result": result,
        })

    # ── BRS summary ───────────────────────────────────────────
    zoho_balance  = sum(
        (tx.zoho_amount or 0) - (tx.bank_amount or 0)
        for tx in DISCREPANCIES
        if tx.zoho_amount is not None or tx.bank_amount is not None
    )

    print(f"{BOLD}{'─'*72}{RESET}")
    print(f"{BOLD}  CLASSIFICATION SUMMARY{RESET}")
    for t, count in summary.items():
        if count:
            col = TYPE_COLORS.get(t, "")
            meta = TYPE_META[t]
            print(f"  {col}{t} — {meta['title']}: {count} item(s){RESET}")

    print(f"\n{BOLD}  NET BOOK-vs-BANK VARIANCE: ₹{abs(zoho_balance):,.2f}{RESET}")
    print(f"{BOLD}{'─'*72}{RESET}\n")

    return results


# ─────────────────────────────────────────────────────────────
# CSV export
# ─────────────────────────────────────────────────────────────

def export_csv(results: list[dict], path: str = "decision_tree_output.csv") -> None:
    rows = []
    for r in results:
        tx, result = r["tx"], r["result"]
        rows.append({
            "S.No":          r["index"],
            "Date":          tx.date,
            "Description":   tx.description,
            "Zoho Amount":   f"₹{tx.zoho_amount:,.2f}" if tx.zoho_amount is not None else "",
            "Bank Amount":   f"₹{tx.bank_amount:,.2f}" if tx.bank_amount is not None else "",
            "Type":          result.type,
            "Label":         result.label,
            "Decision Path": " | ".join(result.path),
            "Action":        result.action,
            "Urgent":        "Yes" if TYPE_META.get(result.type, {}).get("urgent") else "No",
        })
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ CSV exported → {path}")


# ─────────────────────────────────────────────────────────────
# HTML report export
# ─────────────────────────────────────────────────────────────

TYPE_BADGE_CSS = {
    "Type A": "#e53e3e",
    "Type B": "#9b2c2c",
    "Type C": "#d69e2e",
    "Type D": "#2b6cb0",
    "Match":  "#276749",
    "Note":   "#718096",
}

def export_html(results: list[dict], path: str = "bank_recon_report.html") -> None:
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")

    summary_counts = {}
    for r in results:
        t = r["result"].type
        summary_counts[t] = summary_counts.get(t, 0) + 1

    # Build row HTML
    rows_html = ""
    for r in results:
        tx, result = r["tx"], r["result"]
        color  = TYPE_BADGE_CSS.get(result.type, "#718096")
        urgent = TYPE_META.get(result.type, {}).get("urgent", False)
        zoho   = f"₹{tx.zoho_amount:,.2f}" if tx.zoho_amount is not None else "—"
        bank   = f"₹{tx.bank_amount:,.2f}" if tx.bank_amount is not None else "—"
        path_steps = "".join(f"<li>{s}</li>" for s in result.path)
        urgent_badge = '<span class="urgent">⚠ Urgent</span>' if urgent else ""

        rows_html += f"""
        <tr>
          <td class="num">{r['index']:02d}</td>
          <td>{tx.date}</td>
          <td class="desc">{tx.description}</td>
          <td class="amt">{zoho}</td>
          <td class="amt">{bank}</td>
          <td><span class="badge" style="background:{color}">{result.type}</span></td>
          <td>{result.label} {urgent_badge}</td>
          <td><ul class="path">{path_steps}</ul></td>
          <td class="action">{result.action}</td>
        </tr>"""

    # Summary cards
    cards_html = ""
    for t, meta in TYPE_META.items():
        count = summary_counts.get(t, 0)
        if not count:
            continue
        color = TYPE_BADGE_CSS.get(t, "#718096")
        cards_html += f"""
        <div class="card" style="border-left:4px solid {color}">
          <div class="card-type" style="color:{color}">{t}</div>
          <div class="card-title">{meta['title']}</div>
          <div class="card-count">{count}</div>
          <div class="card-desc">{meta['desc']}</div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Bank Recon — Arka Tea Traders Q1 2026</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #f7f8fa;
    color: #1a202c;
    padding: 2rem;
  }}
  header {{
    background: #1a365d;
    color: #fff;
    padding: 1.5rem 2rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }}
  header h1 {{ font-size: 1.4rem; font-weight: 700; }}
  header p  {{ font-size: 0.85rem; opacity: .7; margin-top: .3rem; }}

  .cards {{
    display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;
  }}
  .card {{
    background: #fff;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    flex: 1 1 180px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
  }}
  .card-type  {{ font-size: .75rem; font-weight: 700; letter-spacing: .05em; }}
  .card-title {{ font-size: .85rem; font-weight: 600; margin: .2rem 0; color: #2d3748; }}
  .card-count {{ font-size: 2rem; font-weight: 800; line-height: 1; margin: .3rem 0; }}
  .card-desc  {{ font-size: .72rem; color: #718096; }}

  table {{
    width: 100%; border-collapse: collapse;
    background: #fff; border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
    overflow: hidden;
    font-size: .82rem;
  }}
  thead tr {{ background: #1a365d; color: #fff; }}
  thead th {{ padding: .6rem .8rem; text-align: left; font-weight: 600; white-space: nowrap; }}
  tbody tr:nth-child(even) {{ background: #f7f8fa; }}
  tbody tr:hover {{ background: #ebf4ff; }}
  td {{ padding: .55rem .8rem; vertical-align: top; border-bottom: 1px solid #e2e8f0; }}
  .num  {{ text-align: center; font-weight: 700; color: #718096; }}
  .amt  {{ text-align: right; font-family: monospace; white-space: nowrap; }}
  .desc {{ max-width: 200px; }}
  .action {{ font-size: .78rem; color: #2d3748; max-width: 220px; }}
  .badge {{
    display: inline-block;
    color: #fff;
    padding: .2rem .55rem;
    border-radius: 999px;
    font-size: .72rem;
    font-weight: 700;
    white-space: nowrap;
  }}
  .urgent {{
    display: inline-block;
    background: #fff3cd;
    color: #856404;
    font-size: .68rem;
    font-weight: 600;
    padding: .1rem .4rem;
    border-radius: 4px;
    margin-left: .3rem;
  }}
  ul.path {{
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: .75rem;
    color: #4a5568;
  }}
  ul.path li::before {{ content: "→ "; color: #a0aec0; }}
  footer {{
    margin-top: 1.5rem;
    text-align: right;
    font-size: .75rem;
    color: #a0aec0;
  }}
</style>
</head>
<body>
  <header>
    <h1>🏦 Bank Reconciliation — Q1 2026</h1>
    <p>Arka Tea Traders Pvt Ltd &nbsp;|&nbsp; HDFC Current Account &nbsp;|&nbsp; Generated: {now}</p>
  </header>

  <div class="cards">{cards_html}</div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Date</th><th>Description</th>
        <th>Zoho</th><th>Bank</th>
        <th>Type</th><th>Label</th>
        <th>Decision Path</th><th>Action</th>
      </tr>
    </thead>
    <tbody>{rows_html}</tbody>
  </table>

  <footer>Deterministic rule-based classifier &nbsp;|&nbsp; Arka Tea Traders BRS Tool</footer>
</body>
</html>"""

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  ✓ HTML report exported → {path}")


# ─────────────────────────────────────────────────────────────
# JSON export  (useful for piping to dashboards / Zoho API)
# ─────────────────────────────────────────────────────────────

def export_json(results: list[dict], path: str = "decision_tree_output.json") -> None:
    payload = []
    for r in results:
        tx, result = r["tx"], r["result"]
        payload.append({
            "index":       r["index"],
            "date":        tx.date,
            "description": tx.description,
            "zoho_amount": tx.zoho_amount,
            "bank_amount": tx.bank_amount,
            "type":        result.type,
            "label":       result.label,
            "action":      result.action,
            "decision_path": result.path,
            "urgent":      TYPE_META.get(result.type, {}).get("urgent", False),
        })
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"  ✓ JSON exported → {path}")


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = run_all()

    OUT = "/mnt/user-data/outputs"
    export_csv(results,  f"{OUT}/decision_tree_output.csv")
    export_html(results, f"{OUT}/bank_recon_report.html")
    export_json(results, f"{OUT}/decision_tree_output.json")
