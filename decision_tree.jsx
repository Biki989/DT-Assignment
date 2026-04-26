import { useState } from "react";

const TREE = {
  id: "start",
  question: "Is this item present in the Bank Statement?",
  yes: {
    id: "in_bank",
    question: "Is this item present in Zoho?",
    yes: {
      id: "in_both",
      question: "Do the amounts match exactly?",
      yes: {
        id: "amounts_match",
        question: "Do the dates match (within 3 business days)?",
        yes: {
          id: "result_ok",
          result: true,
          type: "MATCH",
          label: "No Discrepancy",
          color: "#22c55e",
          bg: "#052e16",
          description: "This transaction reconciles perfectly. No action required.",
          action: "None"
        },
        no: {
          id: "date_mismatch",
          question: "Is this a cheque deposit or cheque clearing item?",
          yes: {
            id: "result_c_date",
            result: true,
            type: "TYPE C",
            label: "Timing Difference",
            color: "#f59e0b",
            bg: "#2d1b00",
            description: "Cheque deposited/issued by company but cleared by bank on a different date. Legitimate clearing lag.",
            action: "Disclose in BRS. No journal entry required."
          },
          no: {
            id: "result_a_date",
            result: true,
            type: "TYPE A",
            label: "Wrong Date in Zoho",
            color: "#ef4444",
            bg: "#2d0a0a",
            description: "Transaction exists in both systems with matching amounts but dates differ beyond clearing lag. Date was entered incorrectly in Zoho.",
            action: "Correct the transaction date in Zoho to match the bank value date."
          }
        }
      },
      no: {
        id: "amt_mismatch",
        question: "Is the discrepancy likely caused by a bank error (e.g. wrong charge levied)?",
        yes: {
          id: "result_b",
          result: true,
          type: "TYPE B",
          label: "Bank Error",
          color: "#8b5cf6",
          bg: "#1e0a3c",
          description: "The bank has recorded an incorrect amount. This is rare but possible (e.g. wrongly levied charge, duplicate bank debit).",
          action: "Raise a formal dispute with the bank. Document in BRS. Await bank correction — do not adjust Zoho."
        },
        no: {
          id: "result_a_amt",
          result: true,
          type: "TYPE A",
          label: "Wrong Amount in Zoho",
          color: "#ef4444",
          bg: "#2d0a0a",
          description: "Transaction exists in both systems but Zoho amount differs from bank amount. Likely a keying error or invoice mismatch.",
          action: "Correct the Zoho entry amount to match the bank debit/credit. Verify against original vendor invoice."
        }
      }
    },
    no: {
      id: "bank_only",
      question: "Is this a prior-period or opening balance item (pre-dating this statement period)?",
      yes: {
        id: "result_d",
        result: true,
        type: "TYPE D",
        label: "Prior-Period / Opening Balance Issue",
        color: "#06b6d4",
        bg: "#0a1f2d",
        description: "This item originates from a period before the current reconciliation window. The opening balance gap is a symptom of an unresolved prior reconciliation.",
        action: "Pull prior period bank statement and Zoho ledger. Identify unrecorded items from last period. Post prior-period adjustment journal."
      },
      no: {
        id: "bank_only_2",
        question: "Is this a bank-generated entry? (interest credit, charges, GST on charges, bank fees)",
        yes: {
          id: "result_a_bank_gen",
          result: true,
          type: "TYPE A",
          label: "Missing Bank-Originated Entry in Zoho",
          color: "#ef4444",
          bg: "#2d0a0a",
          description: "The bank has generated a debit or credit (interest, charges) that was never recorded in Zoho. These entries are invisible to Zoho unless manually posted.",
          action: "Post journal entry: Dr/Cr HDFC Current A/c ↔ Cr/Dr Income or Expense account as appropriate."
        },
        no: {
          id: "bank_only_3",
          question: "Is this a recurring standing instruction (rent, EMI, subscription)?",
          yes: {
            id: "result_a_si",
            result: true,
            type: "TYPE A",
            label: "Missing Standing Instruction Entry",
            color: "#ef4444",
            bg: "#2d0a0a",
            description: "Bank executed a standing instruction that was not journalised in Zoho. Common when SI posting relies on manual memory rather than a checklist.",
            action: "Post the missing entry in Zoho. Add this SI to a monthly checklist so future months are not missed."
          },
          no: {
            id: "result_a_missing",
            result: true,
            type: "TYPE A",
            label: "Missing Entry in Zoho",
            color: "#ef4444",
            bg: "#2d0a0a",
            description: "A bank transaction has no corresponding entry in Zoho. The transaction was simply not recorded.",
            action: "Identify the nature of the transaction (receipt or payment) and post the missing journal entry in Zoho."
          }
        }
      }
    }
  },
  no: {
    id: "not_in_bank",
    question: "Is this item present in Zoho?",
    yes: {
      id: "zoho_only",
      question: "Is this a cheque issued or deposit lodged near period-end (last 5 days of month)?",
      yes: {
        id: "result_c_outstanding",
        result: true,
        type: "TYPE C",
        label: "Outstanding / Uncleared Item",
        color: "#f59e0b",
        bg: "#2d1b00",
        description: "Item recorded in Zoho but not yet processed by the bank. Typical for cheques issued late in the month or deposits-in-transit.",
        action: "Disclose as outstanding item in BRS. Monitor next month's bank statement to confirm clearance."
      },
      no: {
        id: "zoho_only_2",
        question: "Could this be a duplicate entry in Zoho (same amount/party on consecutive days)?",
        yes: {
          id: "result_a_dup",
          result: true,
          type: "TYPE A",
          label: "Duplicate Entry in Zoho",
          color: "#ef4444",
          bg: "#2d0a0a",
          description: "The same transaction appears twice in Zoho but only once (or not at all) in the bank statement. A second entry was keyed in error.",
          action: "Reverse/delete the duplicate entry in Zoho. Verify the original entry is correct before reversing."
        },
        no: {
          id: "result_a_phantom",
          result: true,
          type: "TYPE A",
          label: "Phantom Entry in Zoho",
          color: "#ef4444",
          bg: "#2d0a0a",
          description: "A Zoho entry has no bank counterpart and is not explainable as a timing item. Entry should not exist.",
          action: "Investigate with the person who posted the entry. If erroneous, reverse it with a contra journal."
        }
      }
    },
    no: {
      id: "result_neither",
      result: true,
      type: "NOTE",
      label: "Not in Either System",
      color: "#94a3b8",
      bg: "#1e2533",
      description: "If an item is in neither system, there is no discrepancy to classify. This should not appear in a reconciliation exercise.",
      action: "Re-examine the source data. This may indicate a data extraction issue."
    }
  }
};

const TYPE_COLORS = {
  "TYPE A": { border: "#ef4444", text: "#ef4444", badge: "#2d0a0a" },
  "TYPE B": { border: "#8b5cf6", text: "#8b5cf6", badge: "#1e0a3c" },
  "TYPE C": { border: "#f59e0b", text: "#f59e0b", badge: "#2d1b00" },
  "TYPE D": { border: "#06b6d4", text: "#06b6d4", badge: "#0a1f2d" },
  "MATCH": { border: "#22c55e", text: "#22c55e", badge: "#052e16" },
  "NOTE": { border: "#94a3b8", text: "#94a3b8", badge: "#1e2533" },
};

const EXAMPLES = [
  { label: "Duplicate ACT Fibernet (21-Jan)", answers: [true, false, null, null, null, null, null, true] },
  { label: "Missing Feb Rent – Ravi Menon", answers: [true, false, null, null, false, false, true] },
  { label: "Credit Interest (31-Jan)", answers: [true, false, null, null, false, true] },
  { label: "Mahadev Provisions cheque date lag", answers: [true, true, true, false, true] },
  { label: "Packaging Solutions wrong amount", answers: [true, true, false, false] },
  { label: "Darjeeling Highland outstanding cheque", answers: [false, true, true] },
  { label: "Opening Balance Gap", answers: [true, false, null, null, true] },
];

export default function App() {
  const [path, setPath] = useState([]);
  const [current, setCurrent] = useState(TREE);
  const [history, setHistory] = useState([]);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState("classify");

  const answer = (yes) => {
    const next = yes ? current.yes : current.no;
    setHistory(h => [...h, { node: current, answer: yes }]);
    setPath(p => [...p, yes]);
    if (next.result) {
      setDone(true);
      setCurrent(next);
    } else {
      setCurrent(next);
    }
  };

  const reset = () => {
    setPath([]);
    setCurrent(TREE);
    setHistory([]);
    setDone(false);
  };

  const back = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setPath(p => p.slice(0, -1));
    setCurrent(prev.node);
    setDone(false);
  };

  const stepCount = history.length + 1;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0e1a",
      color: "#e2e8f0",
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        .btn-yes { background: #052e16; border: 1.5px solid #22c55e; color: #22c55e; }
        .btn-yes:hover { background: #22c55e; color: #052e16; }
        .btn-no { background: #2d0a0a; border: 1.5px solid #ef4444; color: #ef4444; }
        .btn-no:hover { background: #ef4444; color: #2d0a0a; }
        .btn-base { padding: 10px 28px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; border-radius: 4px; transition: all 0.15s; letter-spacing: 0.05em; }
        .tab-active { border-bottom: 2px solid #60a5fa; color: #60a5fa; }
        .tab-inactive { border-bottom: 2px solid transparent; color: #64748b; }
        .tab-btn { background: none; border: none; border-bottom: 2px solid; padding: 10px 20px; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase; transition: all 0.15s; }
        .step-badge { display: inline-block; background: #1e293b; border: 1px solid #334155; color: #94a3b8; font-size: 10px; padding: 2px 8px; border-radius: 2px; letter-spacing: 0.1em; margin-bottom: 12px; }
        .history-item { display: flex; gap: 12px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #1e293b; }
        .ans-yes { color: #22c55e; font-size: 11px; min-width: 28px; }
        .ans-no { color: #ef4444; font-size: 11px; min-width: 28px; }
        .tree-node { border-left: 3px solid; padding: 12px 16px; margin: 8px 0; border-radius: 0 6px 6px 0; }
        .example-btn { background: #0f172a; border: 1px solid #1e293b; color: #94a3b8; padding: 8px 14px; font-family: inherit; font-size: 11px; cursor: pointer; border-radius: 4px; transition: all 0.15s; text-align: left; width: 100%; margin-bottom: 6px; }
        .example-btn:hover { border-color: #60a5fa; color: #60a5fa; background: #0a1628; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0e1a; } ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "18px", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
            BANK RECON CLASSIFIER
          </div>
          <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px", letterSpacing: "0.08em" }}>
            ARKA TEA TRADERS PVT LTD · HDFC CURRENT A/C · Q1 2026
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {["TYPE A","TYPE B","TYPE C","TYPE D"].map(t => (
            <span key={t} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "2px", background: TYPE_COLORS[t].badge, color: TYPE_COLORS[t].text, border: `1px solid ${TYPE_COLORS[t].border}`, letterSpacing: "0.06em" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "0 32px", display: "flex", gap: "0" }}>
        <button className={`tab-btn ${tab === "classify" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("classify")}>Classify Transaction</button>
        <button className={`tab-btn ${tab === "logic" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("logic")}>Decision Logic</button>
        <button className={`tab-btn ${tab === "results" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("results")}>Q1 2026 Results</button>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: "860px", margin: "0 auto" }}>

        {/* CLASSIFY TAB */}
        {tab === "classify" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "24px" }}>
            {/* Main panel */}
            <div>
              {!done ? (
                <div>
                  <div className="step-badge">STEP {stepCount}</div>
                  <div style={{ fontSize: "20px", fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#f1f5f9", lineHeight: 1.4, marginBottom: "28px", letterSpacing: "-0.01em" }}>
                    {current.question}
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "28px" }}>
                    <button className="btn-base btn-yes" onClick={() => answer(true)}>YES →</button>
                    <button className="btn-base btn-no" onClick={() => answer(false)}>NO →</button>
                  </div>
                  {history.length > 0 && (
                    <button onClick={back} style={{ background: "none", border: "none", color: "#475569", fontSize: "11px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", padding: 0 }}>
                      ← BACK
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div className="step-badge">CLASSIFICATION COMPLETE</div>
                  <div style={{ border: `2px solid ${current.color}`, borderRadius: "8px", padding: "24px", background: current.bg, marginBottom: "20px" }}>
                    <div style={{ fontSize: "11px", color: current.color, letterSpacing: "0.12em", marginBottom: "8px" }}>{current.type}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: current.color, marginBottom: "16px" }}>
                      {current.label}
                    </div>
                    <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.7, marginBottom: "16px" }}>
                      {current.description}
                    </div>
                    <div style={{ borderTop: `1px solid ${current.color}30`, paddingTop: "14px" }}>
                      <div style={{ fontSize: "10px", color: current.color, letterSpacing: "0.1em", marginBottom: "6px" }}>RECOMMENDED ACTION</div>
                      <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6 }}>{current.action}</div>
                    </div>
                  </div>
                  <button className="btn-base" onClick={reset} style={{ background: "#0f172a", border: "1.5px solid #334155", color: "#94a3b8", fontFamily: "inherit" }}>
                    ↺ CLASSIFY ANOTHER
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div>
              {/* Path trail */}
              {history.length > 0 && (
                <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "6px", padding: "16px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.1em", marginBottom: "12px" }}>DECISION PATH</div>
                  {history.map((h, i) => (
                    <div key={i} className="history-item">
                      <span className={h.answer ? "ans-yes" : "ans-no"}>{h.answer ? "YES" : "NO"}</span>
                      <span style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5 }}>{h.node.question}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Examples */}
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "6px", padding: "16px" }}>
                <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.1em", marginBottom: "12px" }}>QUICK EXAMPLES (Q1 2026)</div>
                {EXAMPLES.map((ex, i) => (
                  <button key={i} className="example-btn" onClick={() => {
                    reset();
                    // Just reset and let user walk through — examples are for reference
                  }}>
                    {ex.label}
                  </button>
                ))}
                <div style={{ fontSize: "10px", color: "#334155", marginTop: "8px" }}>Click to reset, then classify manually</div>
              </div>
            </div>
          </div>
        )}

        {/* LOGIC TAB */}
        {tab === "logic" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#f1f5f9", marginBottom: "6px" }}>Deterministic Classification Logic</div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                Every discrepancy follows exactly one path through this tree. No ambiguity, no ML — pure rule-based classification.
              </div>
            </div>

            {[
              {
                branch: "Item in Bank only (not in Zoho)",
                color: "#ef4444",
                nodes: [
                  { q: "Prior-period / opening balance item?", yes: "→ TYPE D", no: "↓ continue" },
                  { q: "Bank-generated entry (interest, charges, fees)?", yes: "→ TYPE A: Missing bank-originated entry", no: "↓ continue" },
                  { q: "Recurring standing instruction (rent, EMI)?", yes: "→ TYPE A: Missing SI entry", no: "→ TYPE A: Missing entry in Zoho" },
                ]
              },
              {
                branch: "Item in Zoho only (not in Bank)",
                color: "#f59e0b",
                nodes: [
                  { q: "Cheque/deposit near period-end (last 5 days)?", yes: "→ TYPE C: Outstanding item", no: "↓ continue" },
                  { q: "Possible duplicate (same party/amount, consecutive days)?", yes: "→ TYPE A: Duplicate entry in Zoho", no: "→ TYPE A: Phantom entry" },
                ]
              },
              {
                branch: "Item in Both Systems",
                color: "#22c55e",
                nodes: [
                  { q: "Amounts match exactly?", yes: "↓ check dates", no: "→ Bank error? → TYPE B   |   otherwise → TYPE A: Wrong amount" },
                  { q: "Dates match (within 3 business days)?", yes: "→ ✓ NO DISCREPANCY", no: "→ Cheque/clearing item? → TYPE C   |   otherwise → TYPE A: Wrong date" },
                ]
              }
            ].map((section, si) => (
              <div key={si} style={{ marginBottom: "20px", border: "1px solid #1e293b", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ background: "#0f172a", borderLeft: `3px solid ${section.color}`, padding: "12px 16px" }}>
                  <span style={{ fontSize: "11px", color: section.color, fontWeight: 500, letterSpacing: "0.06em" }}>{section.branch}</span>
                </div>
                {section.nodes.map((node, ni) => (
                  <div key={ni} style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: ni % 2 === 0 ? "#080c16" : "#0a0e1a" }}>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>Q: {node.q}</div>
                    <div style={{ fontSize: "11px" }}>
                      <span style={{ color: "#22c55e" }}>YES: </span><span style={{ color: "#64748b" }}>{node.yes}</span>
                      <br />
                      <span style={{ color: "#ef4444" }}>NO: </span><span style={{ color: "#64748b" }}>{node.no}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#f1f5f9", marginBottom: "6px" }}>Q1 2026 Classification Results</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>All 12 discrepancies identified in the Arka Tea Traders reconciliation</div>
            </div>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "24px" }}>
              {[
                { type: "TYPE A", count: 8, amount: "₹53,587", desc: "Errors in Zoho" },
                { type: "TYPE B", count: 0, amount: "₹0", desc: "Bank Errors" },
                { type: "TYPE C", count: 3, amount: "₹2,80,400", desc: "Timing Items" },
                { type: "TYPE D", count: 1, amount: "₹7,851", desc: "Prior Period" },
              ].map(s => (
                <div key={s.type} style={{ background: TYPE_COLORS[s.type].badge, border: `1px solid ${TYPE_COLORS[s.type].border}30`, borderRadius: "6px", padding: "14px" }}>
                  <div style={{ fontSize: "10px", color: TYPE_COLORS[s.type].text, letterSpacing: "0.1em", marginBottom: "6px" }}>{s.type}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "24px", fontWeight: 800, color: TYPE_COLORS[s.type].text }}>{s.count}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{s.desc}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>{s.amount}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ border: "1px solid #1e293b", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "40px 90px 1fr 80px 100px", background: "#0f172a", padding: "10px 14px", fontSize: "10px", color: "#475569", letterSpacing: "0.08em", gap: "8px" }}>
                <span>#</span><span>DATE</span><span>DESCRIPTION</span><span>TYPE</span><span>DIFFERENCE</span>
              </div>
              {[
                { n:1, date:"01/01/26", desc:"Opening Balance Gap", type:"TYPE D", amt:"₹7,850.50" },
                { n:2, date:"21/01/26", desc:"Duplicate ACT Fibernet (VP-2026/009)", type:"TYPE A", amt:"₹4,500.00" },
                { n:3, date:"31/01/26", desc:"Credit Interest – January", type:"TYPE A", amt:"₹412.00" },
                { n:4, date:"31/01/26", desc:"Bank Charges Q1 – January", type:"TYPE A", amt:"₹472.00" },
                { n:5, date:"11/01/26", desc:"Mahadev Provisions – cheque clearing lag", type:"TYPE C", amt:"₹42,600.00" },
                { n:6, date:"05/02/26", desc:"Feb Rent Ravi Menon – omitted SI", type:"TYPE A", amt:"₹45,000.00" },
                { n:7, date:"17/02/26", desc:"Packaging Solutions – wrong amount", type:"TYPE A", amt:"₹1,800.00" },
                { n:8, date:"28/02/26", desc:"Credit Interest – February", type:"TYPE A", amt:"₹385.00" },
                { n:9, date:"22/02/26", desc:"Monsoon Hotels – cheque clearing lag", type:"TYPE C", amt:"₹2,15,300.00" },
                { n:10, date:"28/03/26", desc:"Darjeeling Highland – outstanding cheque", type:"TYPE C", amt:"₹22,500.00" },
                { n:11, date:"31/03/26", desc:"Credit Interest – March", type:"TYPE A", amt:"₹428.00" },
                { n:12, date:"31/03/26", desc:"Bank Charges Q1 – March", type:"TYPE A", amt:"₹590.00" },
              ].map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 90px 1fr 80px 100px", padding: "10px 14px", fontSize: "12px", gap: "8px", borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#080c16" : "#0a0e1a", alignItems: "center" }}>
                  <span style={{ color: "#334155" }}>{row.n}</span>
                  <span style={{ color: "#475569", fontSize: "11px" }}>{row.date}</span>
                  <span style={{ color: "#94a3b8" }}>{row.desc}</span>
                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "2px", background: TYPE_COLORS[row.type].badge, color: TYPE_COLORS[row.type].text, border: `1px solid ${TYPE_COLORS[row.type].border}30`, letterSpacing: "0.05em", textAlign: "center" }}>{row.type}</span>
                  <span style={{ color: "#64748b", fontSize: "11px", textAlign: "right" }}>{row.amt}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "16px", padding: "14px 16px", background: "#052e16", border: "1px solid #22c55e30", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>BRS Result after all adjustments</span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "14px", fontWeight: 800, color: "#22c55e" }}>DIFFERENCE: NIL ✓</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}