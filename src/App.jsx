import { useState, useEffect, useRef } from "react";

// ─── INITIAL DATA ──────────────────────────────────────────────────────────────
const USERS = [
  { id: "admin", name: "Admin", role: "admin", password: "admin123", avatar: "A" },
  { id: "eng1", name: "Arjun Menon", role: "engineer", password: "eng123", avatar: "AM", department: "South Kerala" },
  { id: "eng2", name: "Priya Nair", role: "engineer", password: "eng456", avatar: "PN", department: "North Kerala" },
  { id: "eng3", name: "Rahul Das", role: "engineer", password: "eng789", avatar: "RD", department: "Central Kerala" },
];

const CATEGORIES = [
  { id: "travel", label: "Travel", icon: "✈️", color: "#3B82F6" },
  { id: "accommodation", label: "Accommodation", icon: "🏨", color: "#8B5CF6" },
  { id: "local_purchase", label: "Local Purchase", icon: "🛒", color: "#F59E0B" },
  { id: "other", label: "Other", icon: "📦", color: "#6B7280" },
];

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#F59E0B", bg: "#FEF3C7" },
  approved: { label: "Approved", color: "#10B981", bg: "#D1FAE5" },
  rejected: { label: "Rejected", color: "#EF4444", bg: "#FEE2E2" },
};

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
function useStorage(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : init;
    } catch { return init; }
  });
  const set = (v) => {
    const next = typeof v === "function" ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };
  return [val, set];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 10);
const weekOf = (d) => { const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); return dt.toISOString().split("T")[0]; };
const monthOf = (d) => d?.slice(0, 7);

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Avatar({ user, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #1E40AF, #7C3AED)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.35,
      fontFamily: "'DM Mono', monospace", flexShrink: 0,
    }}>{user.avatar}</div>
  );
}

function Badge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: c.color, background: c.bg, fontFamily: "'DM Mono', monospace",
      letterSpacing: "0.04em", textTransform: "uppercase",
    }}>{c.label}</span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, ...style,
    }}>{children}</div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style, small }) {
  const base = {
    border: "none", borderRadius: small ? 8 : 10, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
    fontSize: small ? 12 : 14, padding: small ? "6px 14px" : "10px 22px",
    transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
    display: "inline-flex", alignItems: "center", gap: 6, ...style,
  };
  const variants = {
    primary: { background: "linear-gradient(135deg,#1E40AF,#3B82F6)", color: "#fff" },
    success: { background: "linear-gradient(135deg,#065F46,#10B981)", color: "#fff" },
    danger: { background: "linear-gradient(135deg,#991B1B,#EF4444)", color: "#fff" },
    ghost: { background: "#F3F4F6", color: "#374151" },
    outline: { background: "#fff", color: "#1E40AF", border: "1.5px solid #1E40AF" },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const handle = () => {
    const u = USERS.find(u => u.id === id && u.password === pw);
    if (u) onLogin(u);
    else setErr("Invalid credentials. Try again.");
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ textAlign: "center", width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{
          width: 72, height: 72, background: "linear-gradient(135deg,#3B82F6,#7C3AED)",
          borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px", fontSize: 32,
        }}>⚡</div>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>FieldExpense Pro</h1>
        <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 32px" }}>Field Engineer Expense Management</p>

        <Card>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>User ID</label>
            <select value={id} onChange={e => setId(e.target.value)} style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB",
              fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#F9FAFB", boxSizing: "border-box",
            }}>
              <option value="">Select user...</option>
              {USERS.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()}
              placeholder="Enter password" style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB",
                fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
              }} />
          </div>
          {err && <p style={{ color: "#EF4444", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}
          <Button onClick={handle} style={{ width: "100%" }} disabled={!id || !pw}>Sign In →</Button>
        </Card>

        <p style={{ color: "#475569", fontSize: 12, marginTop: 20 }}>
          Demo: admin/admin123 · eng1/eng123 · eng2/eng456 · eng3/eng789
        </p>
      </div>
    </div>
  );
}

// ─── FUND REQUEST FORM ────────────────────────────────────────────────────────
function FundRequestForm({ user, onSubmit, onClose }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("travel");

  const submit = () => {
    if (!amount || !reason) return;
    onSubmit({ id: uid(), engineerId: user.id, engineerName: user.name, amount: parseFloat(amount), reason, category, status: "pending", date: today(), type: "fund_request" });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💰 Request Funds</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </Field>
        <Field label="Amount Requested (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
        </Field>
        <Field label="Reason / Description">
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe why you need these funds..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={submit} disabled={!amount || !reason} style={{ flex: 1 }}>Submit Request</Button>
        </div>
      </Card>
    </div>
  );
}

// ─── EXPENSE FORM ─────────────────────────────────────────────────────────────
function ExpenseForm({ user, availableBalance, onSubmit, onClose, editItem }) {
  const [amount, setAmount] = useState(editItem?.amount || "");
  const [category, setCategory] = useState(editItem?.category || "travel");
  const [description, setDescription] = useState(editItem?.description || "");
  const [date, setDate] = useState(editItem?.date || today());
  const [attachment, setAttachment] = useState(editItem?.attachment || null);
  const [attachName, setAttachName] = useState(editItem?.attachName || "");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const b64 = await fileToBase64(file);
    setAttachment(b64);
    setAttachName(file.name);
  };

  const submit = () => {
    if (!amount || !description || !attachment) return;
    onSubmit({
      id: editItem?.id || uid(),
      engineerId: user.id, engineerName: user.name,
      amount: parseFloat(amount), category, description,
      date, attachment, attachName,
      type: "expense", status: "approved",
    });
    onClose();
  };

  const over = parseFloat(amount) > availableBalance;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <Card style={{ width: "100%", maxWidth: 500, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editItem ? "✏️ Edit Expense" : "🧾 Add Expense"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>
        <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          Available Balance: <strong style={{ color: "#1E40AF" }}>{fmt(availableBalance)}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field label="Amount (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, borderColor: over ? "#EF4444" : undefined }} />
          {over && <span style={{ color: "#EF4444", fontSize: 12 }}>⚠ Exceeds available balance</span>}
        </Field>
        <Field label="Description">
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this expense for?" style={inputStyle} />
        </Field>
        <Field label="Attachment (Mandatory — Bill/Receipt)">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async e => { e.preventDefault(); setDragOver(false); await handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${attachment ? "#10B981" : dragOver ? "#3B82F6" : "#D1D5DB"}`,
              borderRadius: 10, padding: "16px", textAlign: "center",
              cursor: "pointer", background: attachment ? "#F0FDF4" : dragOver ? "#EFF6FF" : "#F9FAFB",
              transition: "all 0.2s",
            }}>
            {attachment
              ? <><span style={{ fontSize: 22 }}>✅</span><br /><span style={{ fontSize: 13, color: "#065F46", fontWeight: 600 }}>{attachName}</span><br /><span style={{ fontSize: 11, color: "#6B7280" }}>Click to replace</span></>
              : <><span style={{ fontSize: 22 }}>📎</span><br /><span style={{ fontSize: 13, color: "#6B7280" }}>Drag & drop or click to upload</span><br /><span style={{ fontSize: 11, color: "#9CA3AF" }}>PDF, JPG, PNG supported</span></>
            }
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        </Field>
        {!attachment && <p style={{ color: "#EF4444", fontSize: 12, margin: "-8px 0 8px" }}>⚠ Bill/receipt attachment is mandatory</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={submit} disabled={!amount || !description || !attachment || over} style={{ flex: 1 }}>
            {editItem ? "Update Expense" : "Add Expense"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── LEDGER ───────────────────────────────────────────────────────────────────
function Ledger({ entries, requests }) {
  const approved = requests.filter(r => r.status === "approved");
  const totalFunds = approved.reduce((s, r) => s + r.amount, 0);
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0);
  const balance = totalFunds - totalSpent;

  return (
    <Card style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>📒 My Ledger</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Total Approved Funds", value: fmt(totalFunds), color: "#10B981", icon: "💰" },
          { label: "Total Spent", value: fmt(totalSpent), color: "#EF4444", icon: "🧾" },
          { label: "Available Balance", value: fmt(balance), color: balance < 0 ? "#EF4444" : "#1E40AF", icon: "📊" },
        ].map(item => (
          <div key={item.label} style={{ background: "#F9FAFB", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── EXPENSE LIST ─────────────────────────────────────────────────────────────
function ExpenseList({ expenses, onEdit, onViewAttachment, isAdmin, filter }) {
  const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[3];

  const filtered = expenses.filter(e => {
    if (!filter.period || filter.period === "all") return true;
    if (filter.period === "weekly") return weekOf(e.date) === weekOf(today());
    if (filter.period === "monthly") return monthOf(e.date) === monthOf(today());
    return true;
  }).filter(e => !filter.engineer || e.engineerId === filter.engineer);

  if (!filtered.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 14 }}>No expenses found for the selected filter.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(exp => {
        const c = cat(exp.category);
        return (
          <div key={exp.id} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px", background: "#FAFAFA",
            borderRadius: 12, border: "1px solid #F3F4F6",
            transition: "all 0.15s",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: c.color + "20", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>{c.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 2 }}>{exp.description}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {c.label} · {exp.date}
                {isAdmin && <> · <span style={{ color: "#6B7280" }}>{exp.engineerName}</span></>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#EF4444" }}>-{fmt(exp.amount)}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
                {exp.attachment && (
                  <Button small variant="ghost" onClick={() => onViewAttachment(exp)}>📎 Bill</Button>
                )}
                {!isAdmin && (
                  <Button small variant="outline" onClick={() => onEdit(exp)}>Edit</Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── REQUEST LIST ─────────────────────────────────────────────────────────────
function RequestList({ requests, onApprove, onReject, isAdmin, engineerId }) {
  const list = isAdmin ? requests : requests.filter(r => r.engineerId === engineerId);
  if (!list.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 14 }}>No fund requests yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {list.map(req => {
        const c = CATEGORIES.find(c => c.id === req.category) || CATEGORIES[3];
        return (
          <div key={req.id} style={{
            padding: "14px 16px", background: "#FAFAFA",
            borderRadius: 12, border: "1px solid #F3F4F6",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#1E40AF" }}>{fmt(req.amount)}</span>
                <Badge status={req.status} />
              </div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>{req.reason}</div>
              {isAdmin && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>By: {req.engineerName} · {req.date}</div>}
            </div>
            {isAdmin && req.status === "pending" && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Button small variant="success" onClick={() => onApprove(req.id)}>✓ Approve</Button>
                <Button small variant="danger" onClick={() => onReject(req.id)}>✗ Reject</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ATTACHMENT VIEWER ────────────────────────────────────────────────────────
function AttachmentViewer({ exp, onClose }) {
  const isImg = exp.attachment?.startsWith("data:image");
  const isPdf = exp.attachment?.startsWith("data:application/pdf");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ fontSize: 15 }}>{exp.attachName}</strong>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>{exp.description} · {fmt(exp.amount)}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 20, textAlign: "center" }}>
          {isImg && <img src={exp.attachment} alt="receipt" style={{ maxWidth: "100%", borderRadius: 8 }} />}
          {isPdf && <iframe src={exp.attachment} style={{ width: "100%", height: 500, border: "none", borderRadius: 8 }} title="bill" />}
          {!isImg && !isPdf && <p style={{ color: "#6B7280" }}>Preview not available. File: {exp.attachName}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN SUMMARY ────────────────────────────────────────────────────────────
function AdminSummary({ expenses, requests }) {
  const engineers = USERS.filter(u => u.role === "engineer");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
      {engineers.map(eng => {
        const engExpenses = expenses.filter(e => e.engineerId === eng.id);
        const engRequests = requests.filter(r => r.engineerId === eng.id && r.status === "approved");
        const spent = engExpenses.reduce((s, e) => s + e.amount, 0);
        const funds = engRequests.reduce((s, r) => s + r.amount, 0);
        const bal = funds - spent;
        return (
          <Card key={eng.id} style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <Avatar user={eng} size={36} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{eng.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{eng.department}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6B7280" }}>Funds</span>
                <span style={{ color: "#10B981", fontWeight: 700 }}>{fmt(funds)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6B7280" }}>Spent</span>
                <span style={{ color: "#EF4444", fontWeight: 700 }}>{fmt(spent)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid #F3F4F6" }}>
                <span style={{ color: "#374151", fontWeight: 600 }}>Balance</span>
                <span style={{ color: bal < 0 ? "#EF4444" : "#1E40AF", fontWeight: 700 }}>{fmt(bal)}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── FIELD & INPUT STYLE ──────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  background: "#F9FAFB", boxSizing: "border-box",
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useStorage("fse_expenses", []);
  const [requests, setRequests] = useStorage("fse_requests", []);
  const [tab, setTab] = useState("dashboard");
  const [showFundForm, setShowFundForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [viewAttachment, setViewAttachment] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterEngineer, setFilterEngineer] = useState("");

  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === "admin";
  const myRequests = requests.filter(r => r.engineerId === user.id);
  const myExpenses = expenses.filter(e => e.engineerId === user.id);
  const approvedFunds = myRequests.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const totalSpent = myExpenses.reduce((s, e) => s + e.amount, 0);
  const availableBalance = approvedFunds - totalSpent;

  const addRequest = (req) => setRequests(prev => [req, ...prev]);
  const addExpense = (exp) => {
    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === exp.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = exp; return next; }
      return [exp, ...prev];
    });
  };
  const approveRequest = (id) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "approved" } : r));
  const rejectRequest = (id) => setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "rejected" } : r));

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const tabs = isAdmin
    ? [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "requests", label: `Requests${pendingCount ? ` (${pendingCount})` : ""}`, icon: "📋" },
        { id: "expenses", label: "All Expenses", icon: "🧾" },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "requests", label: "Fund Requests", icon: "💰" },
        { id: "expenses", label: "My Expenses", icon: "🧾" },
      ];

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'DM Sans', sans-serif" }}>
      {/* NAV */}
      <div style={{
        background: "#0F172A",
        padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 24, height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
            <div style={{ fontSize: 22 }}>⚡</div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>FieldExpense</span>
          </div>
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? "rgba(59,130,246,0.2)" : "none",
                border: "none", borderRadius: 8, padding: "6px 14px",
                color: tab === t.id ? "#60A5FA" : "#94A3B8", cursor: "pointer",
                fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                fontFamily: "'DM Sans', sans-serif",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar user={user} size={32} />
            <div>
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1 }}>{user.name}</div>
              <div style={{ color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{user.role}</div>
            </div>
            <button onClick={() => setUser(null)} style={{
              background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8,
              color: "#94A3B8", padding: "6px 12px", cursor: "pointer", fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", marginLeft: 8,
            }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <>
            {isAdmin ? (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Admin Dashboard</h2>
                  <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>Overview of all field engineers</p>
                </div>
                {/* Global stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                  {[
                    { label: "Total Engineers", value: USERS.filter(u => u.role === "engineer").length, icon: "👷", color: "#1E40AF" },
                    { label: "Pending Requests", value: requests.filter(r => r.status === "pending").length, icon: "⏳", color: "#D97706" },
                    { label: "Total Disbursed", value: fmt(requests.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0)), icon: "💰", color: "#065F46" },
                    { label: "Total Expenses", value: fmt(expenses.reduce((s, e) => s + e.amount, 0)), icon: "🧾", color: "#7C3AED" },
                  ].map(s => (
                    <Card key={s.label} style={{ padding: "18px 20px" }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div>
                    </Card>
                  ))}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>Engineer Balances</h3>
                <AdminSummary expenses={expenses} requests={requests} />
                {/* Category breakdown */}
                <Card>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Expenses by Category</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                    {CATEGORIES.map(c => {
                      const total = expenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0);
                      return (
                        <div key={c.id} style={{ background: c.color + "10", borderRadius: 12, padding: "14px 16px", borderLeft: `4px solid ${c.color}` }}>
                          <div style={{ fontSize: 22 }}>{c.icon}</div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: c.color, marginTop: 4 }}>{fmt(total)}</div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>{c.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Welcome, {user.name} 👋</h2>
                    <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>{user.department}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={() => setShowFundForm(true)} variant="outline">💰 Request Funds</Button>
                    <Button onClick={() => { setEditExpense(null); setShowExpenseForm(true); }} disabled={availableBalance <= 0}>🧾 Add Expense</Button>
                  </div>
                </div>
                <Ledger entries={myExpenses} requests={myRequests} />
                {/* Recent expenses */}
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Recent Expenses</h3>
                    <Button small variant="ghost" onClick={() => setTab("expenses")}>View all →</Button>
                  </div>
                  <ExpenseList
                    expenses={myExpenses.slice(0, 5)}
                    onEdit={e => { setEditExpense(e); setShowExpenseForm(true); }}
                    onViewAttachment={setViewAttachment}
                    filter={{ period: "all" }}
                  />
                </Card>
              </>
            )}
          </>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Fund Requests</h2>
              {!isAdmin && <Button onClick={() => setShowFundForm(true)}>💰 New Request</Button>}
            </div>
            <Card>
              <RequestList
                requests={requests}
                onApprove={approveRequest}
                onReject={rejectRequest}
                isAdmin={isAdmin}
                engineerId={user.id}
              />
            </Card>
          </>
        )}

        {/* EXPENSES TAB */}
        {tab === "expenses" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{isAdmin ? "All Expenses" : "My Expenses"}</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {isAdmin && (
                  <select value={filterEngineer} onChange={e => setFilterEngineer(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}>
                    <option value="">All Engineers</option>
                    {USERS.filter(u => u.role === "engineer").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                )}
                <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}>
                  <option value="all">All Time</option>
                  <option value="weekly">This Week</option>
                  <option value="monthly">This Month</option>
                </select>
                {!isAdmin && (
                  <Button onClick={() => { setEditExpense(null); setShowExpenseForm(true); }} disabled={availableBalance <= 0}>
                    🧾 Add Expense
                  </Button>
                )}
              </div>
            </div>

            {!isAdmin && <Ledger entries={myExpenses} requests={myRequests} />}

            <Card>
              <ExpenseList
                expenses={isAdmin ? expenses : myExpenses}
                onEdit={e => { setEditExpense(e); setShowExpenseForm(true); }}
                onViewAttachment={setViewAttachment}
                isAdmin={isAdmin}
                filter={{ period: filterPeriod, engineer: filterEngineer }}
              />
            </Card>
          </>
        )}
      </div>

      {/* MODALS */}
      {showFundForm && <FundRequestForm user={user} onSubmit={addRequest} onClose={() => setShowFundForm(false)} />}
      {showExpenseForm && (
        <ExpenseForm
          user={user}
          availableBalance={editExpense ? availableBalance + editExpense.amount : availableBalance}
          onSubmit={addExpense}
          onClose={() => { setShowExpenseForm(false); setEditExpense(null); }}
          editItem={editExpense}
        />
      )}
      {viewAttachment && <AttachmentViewer exp={viewAttachment} onClose={() => setViewAttachment(null)} />}
    </div>
  );
}
