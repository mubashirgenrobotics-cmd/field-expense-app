import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

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

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

// ─── RECEIPT DOWNLOAD ─────────────────────────────────────────────────────────
function downloadReceipt(exp) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt - ${exp.description}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
    .header { text-align: center; border-bottom: 2px solid #1E40AF; padding-bottom: 20px; margin-bottom: 24px; }
    .logo { font-size: 28px; font-weight: 800; color: #1E40AF; }
    .subtitle { color: #6B7280; font-size: 13px; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; background: #D1FAE5; color: #065F46; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #6B7280; }
    .value { font-weight: 600; }
    .amount-box { background: #EFF6FF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .amount { font-size: 32px; font-weight: 800; color: #1E40AF; }
    .footer { text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 32px; }
    ${exp.editLog && exp.editLog.length ? `.edit-log { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px; margin-top: 20px; }
    .edit-log h4 { margin: 0 0 10px; color: #92400E; font-size: 13px; }
    .edit-entry { font-size: 12px; color: #78350F; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #FDE68A; }
    .edit-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }` : ""}
  </style></head><body>
  <div class="header"><div class="logo">⚡ FieldExpense Pro</div><div class="subtitle">Official Expense Receipt</div></div>
  <div style="text-align:right; margin-bottom:16px;"><span class="badge">${exp.status.toUpperCase()}</span></div>
  <div class="amount-box"><div style="color:#6B7280;font-size:13px;margin-bottom:6px;">Approved Amount</div><div class="amount">${fmt(exp.amount)}</div></div>
  <div class="row"><span class="label">Engineer</span><span class="value">${exp.engineerName}</span></div>
  <div class="row"><span class="label">Description</span><span class="value">${exp.description}</span></div>
  <div class="row"><span class="label">Category</span><span class="value">${CATEGORIES.find(c => c.id === exp.category)?.label || exp.category}</span></div>
  <div class="row"><span class="label">Date</span><span class="value">${exp.date}</span></div>
  <div class="row"><span class="label">Receipt ID</span><span class="value">#${exp.id.toUpperCase()}</span></div>
  ${exp.editLog && exp.editLog.length ? `<div class="edit-log"><h4>📝 Edit History</h4>${exp.editLog.map(e => `<div class="edit-entry"><strong>${e.date}</strong> · Amount changed from ${fmt(e.before)} → ${fmt(e.after)}<br/><em>Admin note: ${e.comment}</em></div>`).join("")}</div>` : ""}
  <div class="footer">Generated on ${new Date().toLocaleString("en-IN")} · FieldExpense Pro</div>
  </body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${exp.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Avatar({ user, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #1E40AF, #7C3AED)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700,
      fontSize: size * 0.35, fontFamily: "'DM Mono', monospace", flexShrink: 0,
    }}>{user.avatar}</div>
  );
}

function Badge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color,
      background: c.bg, fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", textTransform: "uppercase",
    }}>{c.label}</span>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, ...style }}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", disabled, style, small }) {
  const base = {
    border: "none", borderRadius: small ? 8 : 10, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: small ? 12 : 14, padding: small ? "6px 14px" : "10px 22px",
    transition: "all 0.15s", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6, ...style,
  };
  const variants = {
    primary: { background: "linear-gradient(135deg,#1E40AF,#3B82F6)", color: "#fff" },
    success: { background: "linear-gradient(135deg,#065F46,#10B981)", color: "#fff" },
    danger: { background: "linear-gradient(135deg,#991B1B,#EF4444)", color: "#fff" },
    ghost: { background: "#F3F4F6", color: "#374151" },
    outline: { background: "#fff", color: "#1E40AF", border: "1.5px solid #1E40AF" },
    warning: { background: "linear-gradient(135deg,#92400E,#F59E0B)", color: "#fff" },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
}

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#F9FAFB", boxSizing: "border-box" };

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>{children}</div>;
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{ width: 72, height: 72, background: "linear-gradient(135deg,#3B82F6,#7C3AED)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>⚡</div>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>FieldExpense Pro</h1>
        <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 32px" }}>Field Engineer Expense Management</p>
        <Card>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>User ID</label><select value={id} onChange={e => setId(e.target.value)} style={inputStyle}><option value="">Select user...</option>{USERS.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>
          <div style={{ marginBottom: 20 }}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="Enter password" style={inputStyle} /></div>
          {err && <p style={{ color: "#EF4444", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}
          <Button onClick={handle} style={{ width: "100%" }} disabled={!id || !pw}>Sign In →</Button>
        </Card>
      </div>
    </div>
  );
}

// ─── RESERVED FUND MODAL ──────────────────────────────────────────────────────
function ReservedFundModal({ currentReserved, onSave, onClose }) {
  const [amount, setAmount] = useState(currentReserved || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 380 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>🏦 Reserved Fund</h3>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>Set the total fund pool available for engineer disbursements. Approved requests will be deducted from this amount.</p>
        <Field label="Total Reserved Amount (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter total fund pool" style={inputStyle} />
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => { onSave(parseFloat(amount) || 0); onClose(); }} style={{ flex: 1 }}>Save</Button>
        </div>
      </Card>
    </div>
  );
}

// ─── ADMIN REVIEW MODAL ───────────────────────────────────────────────────────
function AdminReviewModal({ item, type, onClose, onApprove, onReject }) {
  const [amount, setAmount] = useState(item.amount);
  const [comment, setComment] = useState("");
  const amountChanged = parseFloat(amount) !== item.amount;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Review {type === "request" ? "Fund Request" : "Expense"}</h3>
        <div style={{ background: "#F9FAFB", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#4B5563" }}>
          <strong>Engineer:</strong> {item.engineerName}<br />
          <strong>Reason:</strong> {item.reason || item.description}<br />
          <strong>Date:</strong> {item.date}<br />
          <strong>Original Amount:</strong> <span style={{ color: "#1E40AF", fontWeight: 700 }}>{fmt(item.amount)}</span>
        </div>
        <Field label="Approved Amount (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
        </Field>
        {amountChanged && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
            <span style={{ color: "#92400E", fontWeight: 600 }}>⚠️ Amount edited:</span>{" "}
            <span style={{ color: "#78350F" }}>{fmt(item.amount)} → {fmt(parseFloat(amount) || 0)}</span>
            <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>A note will be marked on this item.</div>
          </div>
        )}
        <Field label={`Admin Comment ${amountChanged ? "(required)" : "(optional)"}`}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a note or reason for approval/edit..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => { onReject(item.id, comment); onClose(); }} variant="danger" style={{ flex: 1 }}>Reject</Button>
          <Button
            onClick={() => { onApprove(item.id, parseFloat(amount), comment, item.amount); onClose(); }}
            variant="success"
            disabled={amountChanged && !comment.trim()}
            style={{ flex: 1 }}
          >Approve</Button>
        </div>
      </Card>
    </div>
  );
}

// ─── FORMS ────────────────────────────────────────────────────────────────────
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💰 Request Funds</h3><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button></div>
        <Field label="Category"><select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></Field>
        <Field label="Amount Requested (₹)"><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
        <Field label="Reason / Description"><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe why you need these funds..." rows={3} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}><Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button><Button onClick={submit} disabled={!amount || !reason} style={{ flex: 1 }}>Submit Request</Button></div>
      </Card>
    </div>
  );
}

function ExpenseForm({ user, availableBalance, onSubmit, onClose, editItem }) {
  const [amount, setAmount] = useState(editItem?.amount || "");
  const [category, setCategory] = useState(editItem?.category || "travel");
  const [description, setDescription] = useState(editItem?.description || "");
  const [date, setDate] = useState(editItem?.date || today());
  const [attachment, setAttachment] = useState(editItem?.attachment || null);
  const [attachName, setAttachName] = useState(editItem?.attachName || "");
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setAttachName(file.name);
    if (file.type.startsWith("image/")) {
      const compressed = await compressImage(file);
      setAttachment(compressed);
    } else {
      const b64 = await fileToBase64(file);
      setAttachment(b64);
    }
  };

  const submit = () => {
    if (!amount || !description || !attachment) return;
    onSubmit({
      id: editItem?.id || uid(), engineerId: user.id, engineerName: user.name,
      amount: parseFloat(amount), category, description, date, attachment, attachName,
      type: "expense", status: "pending",
      editLog: editItem?.editLog || [],
    });
    onClose();
  };

  const over = parseFloat(amount) > availableBalance;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <Card style={{ width: "100%", maxWidth: 500, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editItem ? "✏️ Edit Expense" : "🧾 Add Expense"}</h3><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button></div>
        <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>Available Balance: <strong style={{ color: "#1E40AF" }}>{fmt(availableBalance)}</strong></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Field label="Category"><select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></Field><Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field></div>
        <Field label="Amount (₹)"><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, borderColor: over ? "#EF4444" : undefined }} />{over && <span style={{ color: "#EF4444", fontSize: 12 }}>⚠ Exceeds available balance</span>}</Field>
        <Field label="Description"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this expense for?" style={inputStyle} /></Field>
        <Field label="Attachment (Camera/Bill)"><div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${attachment ? "#10B981" : "#D1D5DB"}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer", background: attachment ? "#F0FDF4" : "#F9FAFB" }}>{attachment ? <><span style={{ fontSize: 22 }}>✅</span><br /><span style={{ fontSize: 13, color: "#065F46", fontWeight: 600 }}>{attachName}</span></> : <><span style={{ fontSize: 22 }}>📷</span><br /><span style={{ fontSize: 13, color: "#6B7280" }}>Tap to take photo or upload bill</span></>}</div><input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}><Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button><Button onClick={submit} disabled={!amount || !description || !attachment || over} style={{ flex: 1 }}>{editItem ? "Update Expense" : "Submit Expense"}</Button></div>
      </Card>
    </div>
  );
}

// ─── CONFIRM DELETE MODAL ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ item, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 360 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>🗑️ Delete Expense</h3>
        <p style={{ fontSize: 14, color: "#4B5563", margin: "0 0 20px" }}>
          Are you sure you want to delete <strong>{item.description}</strong> ({fmt(item.amount)}) by {item.engineerName}? This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => { onConfirm(item.id); onClose(); }} variant="danger" style={{ flex: 1 }}>Delete</Button>
        </div>
      </Card>
    </div>
  );
}

// ─── LIST COMPONENTS ──────────────────────────────────────────────────────────
function ExpenseList({ expenses, onEdit, onViewAttachment, onReview, onDelete, isAdmin, filter }) {
  const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[3];

  const filtered = expenses.filter(e => {
    if (filter.status !== "all" && e.status !== filter.status) return false;
    if (filter.period === "weekly" && weekOf(e.date) !== weekOf(today())) return false;
    if (filter.period === "monthly" && monthOf(e.date) !== monthOf(today())) return false;
    if (isAdmin && filter.engineer && e.engineerId !== filter.engineer) return false;
    return true;
  });

  // CHANGE 1: Sort by latest first
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!sorted.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 14 }}>No expenses found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map(exp => {
        const c = cat(exp.category);
        const hasEditLog = exp.editLog && exp.editLog.length > 0;
        return (
          <div key={exp.id} style={{ padding: "14px 16px", background: "#FAFAFA", borderRadius: 12, border: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{exp.description}</span>
                  <Badge status={exp.status} />
                  {hasEditLog && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>EDITED</span>}
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{c.label} · {exp.date}{isAdmin && <> · <span style={{ color: "#6B7280" }}>{exp.engineerName}</span></>}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#EF4444" }}>-{fmt(exp.amount)}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4, flexWrap: "wrap" }}>
                  {exp.attachment && <Button small variant="ghost" onClick={() => onViewAttachment(exp)}>📎 Bill</Button>}
                  {!isAdmin && exp.status === "pending" && <Button small variant="outline" onClick={() => onEdit(exp)}>Edit</Button>}
                  {isAdmin && exp.status === "pending" && <Button small variant="primary" onClick={() => onReview(exp)}>Review</Button>}
                  {/* CHANGE 6: Download receipt for admin */}
                  {isAdmin && exp.status === "approved" && <Button small variant="ghost" onClick={() => downloadReceipt(exp)}>⬇️ Receipt</Button>}
                  {/* CHANGE 3: Delete option for admin */}
                  {isAdmin && <Button small variant="danger" onClick={() => onDelete(exp)}>🗑️</Button>}
                </div>
              </div>
            </div>
            {/* CHANGE 5: Show edit log inline */}
            {hasEditLog && (
              <div style={{ marginTop: 10, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
                {exp.editLog.map((entry, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#78350F", background: "#FFFBEB", borderRadius: 6, padding: "6px 10px", marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span>📝 <strong>{entry.date}</strong></span>
                    <span>{fmt(entry.before)} → <strong>{fmt(entry.after)}</strong></span>
                    {entry.comment && <span style={{ color: "#92400E" }}>"{entry.comment}"</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestList({ requests, isAdmin, engineerId, filter, onReview }) {
  // CHANGE 1: Sort by latest first
  const filtered = requests.filter(r => {
    if (!isAdmin && r.engineerId !== engineerId) return false;
    if (filter.status !== "all" && r.status !== filter.status) return false;
    if (filter.period === "weekly" && weekOf(r.date) !== weekOf(today())) return false;
    if (filter.period === "monthly" && monthOf(r.date) !== monthOf(today())) return false;
    if (isAdmin && filter.engineer && r.engineerId !== filter.engineer) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!filtered.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 14 }}>No requests found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(req => {
        const c = CATEGORIES.find(c => c.id === req.category) || CATEGORIES[3];
        const hasEditLog = req.editLog && req.editLog.length > 0;
        return (
          <div key={req.id} style={{ padding: "14px 16px", background: "#FAFAFA", borderRadius: 12, border: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#1E40AF" }}>{fmt(req.amount)}</span>
                  <Badge status={req.status} />
                  {hasEditLog && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>EDITED</span>}
                </div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>{req.reason}</div>
                {isAdmin && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>By: {req.engineerName} · {req.date}</div>}
              </div>
              {isAdmin && req.status === "pending" && (
                <div style={{ flexShrink: 0 }}><Button small variant="primary" onClick={() => onReview(req)}>Review</Button></div>
              )}
            </div>
            {/* CHANGE 5: Show edit log for requests too */}
            {hasEditLog && (
              <div style={{ marginTop: 10, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
                {req.editLog.map((entry, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#78350F", background: "#FFFBEB", borderRadius: 6, padding: "6px 10px", marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span>📝 <strong>{entry.date}</strong></span>
                    <span>{fmt(entry.before)} → <strong>{fmt(entry.after)}</strong></span>
                    {entry.comment && <span style={{ color: "#92400E" }}>"{entry.comment}"</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN DASHBOARD SUMMARY ──────────────────────────────────────────────────
function AdminSummary({ expenses, requests, reservedFund }) {
  const engineers = USERS.filter(u => u.role === "engineer");

  // CHANGE 4: Reserved fund totals
  const totalDisbursed = requests.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const remainingReserved = reservedFund - totalDisbursed;

  // CHANGE 4: Bills summary
  const approvedBills = expenses.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const pendingBills = expenses.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  return (
    <>
      {/* Reserved Fund Overview */}
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg,#0F172A,#1E1B4B)", border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ color: "#fff" }}><div style={{ fontSize: 12, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Reserved Fund Pool</div><div style={{ fontSize: 28, fontWeight: 800, color: "#60A5FA" }}>{fmt(reservedFund)}</div></div>
          <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.1)", display: window.innerWidth > 600 ? "block" : "none" }} />
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>Distributed</div><div style={{ fontSize: 20, fontWeight: 700, color: "#F59E0B" }}>{fmt(totalDisbursed)}</div></div>
          <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.1)", display: window.innerWidth > 600 ? "block" : "none" }} />
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>Remaining</div><div style={{ fontSize: 20, fontWeight: 700, color: remainingReserved < 0 ? "#EF4444" : "#10B981" }}>{fmt(remainingReserved)}</div></div>
          <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.1)", display: window.innerWidth > 600 ? "block" : "none" }} />
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>Approved Bills</div><div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>{fmt(approvedBills)}</div></div>
          <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.1)", display: window.innerWidth > 600 ? "block" : "none" }} />
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4 }}>Pending Bills</div><div style={{ fontSize: 20, fontWeight: 700, color: "#F59E0B" }}>{fmt(pendingBills)}</div></div>
        </div>
        {reservedFund > 0 && (
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (totalDisbursed / reservedFund) * 100)}%`, background: "linear-gradient(90deg,#3B82F6,#7C3AED)", borderRadius: 8, transition: "width 0.5s" }} />
          </div>
        )}
      </Card>

      {/* Per-engineer breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        {engineers.map(eng => {
          const spent = expenses.filter(e => e.engineerId === eng.id && e.status === "approved").reduce((s, e) => s + e.amount, 0);
          const funds = requests.filter(r => r.engineerId === eng.id && r.status === "approved").reduce((s, r) => s + r.amount, 0);
          const bal = funds - spent;
          const pendingBillsEng = expenses.filter(e => e.engineerId === eng.id && e.status === "pending").reduce((s, e) => s + e.amount, 0);
          return (
            <Card key={eng.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}><Avatar user={eng} size={36} /><div><div style={{ fontWeight: 700, fontSize: 14 }}>{eng.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{eng.department}</div></div></div>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6B7280" }}>Funds</span><span style={{ color: "#10B981", fontWeight: 700 }}>{fmt(funds)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6B7280" }}>Approved Bills</span><span style={{ color: "#EF4444", fontWeight: 700 }}>{fmt(spent)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6B7280" }}>Pending Bills</span><span style={{ color: "#F59E0B", fontWeight: 700 }}>{fmt(pendingBillsEng)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid #F3F4F6" }}><span style={{ color: "#374151", fontWeight: 600 }}>Balance</span><span style={{ color: bal < 0 ? "#EF4444" : "#1E40AF", fontWeight: 700 }}>{fmt(bal)}</span></div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => { const saved = localStorage.getItem("activeUser"); return saved ? JSON.parse(saved) : null; });
  const handleLogin = (u) => { localStorage.setItem("activeUser", JSON.stringify(u)); setUser(u); };
  const handleLogout = () => { localStorage.removeItem("activeUser"); setUser(null); };

  const [expenses, setExpenses] = useState([]);
  const [requests, setRequests] = useState([]);
  // CHANGE 4: Reserved fund stored in Firestore meta doc
  const [reservedFund, setReservedFund] = useState(0);
  const [showReservedModal, setShowReservedModal] = useState(false);

  const [tab, setTab] = useState("dashboard");
  const [showFundForm, setShowFundForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [editExpense, setEditExpense] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [viewAttachment, setViewAttachment] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEngineer, setFilterEngineer] = useState("");

  useEffect(() => {
    const unsubExp = onSnapshot(collection(db, "expenses"), (snap) => setExpenses(snap.docs.map(d => d.data())));
    const unsubReq = onSnapshot(collection(db, "requests"), (snap) => setRequests(snap.docs.map(d => d.data())));
    // Load reserved fund from meta
    const unsubMeta = onSnapshot(doc(db, "meta", "admin"), (d) => {
      if (d.exists()) setReservedFund(d.data().reservedFund || 0);
    });
    return () => { unsubExp(); unsubReq(); unsubMeta(); };
  }, []);

  if (!user) return <Login onLogin={handleLogin} />;

  const isAdmin = user.role === "admin";
  const myRequests = requests.filter(r => r.engineerId === user.id);
  const myExpenses = expenses.filter(e => e.engineerId === user.id);

  // CHANGE 2: Available balance only uses APPROVED expenses
  const approvedFunds = myRequests.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const approvedExpenses = myExpenses.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const availableBalance = approvedFunds - approvedExpenses;

  // Firebase Writes
  const addRequest = async (req) => await setDoc(doc(db, "requests", req.id), req);
  const addExpense = async (exp) => await setDoc(doc(db, "expenses", exp.id), exp);

  // CHANGE 5: When approving with edited amount, write editLog
  const approveItem = async (col, id, finalAmount, comment, originalAmount) => {
    const updates = { status: "approved", amount: finalAmount };
    if (finalAmount !== originalAmount) {
      // Fetch existing editLog
      const existing = col === "expenses" ? expenses.find(e => e.id === id) : requests.find(r => r.id === id);
      const log = existing?.editLog || [];
      log.push({ date: today(), before: originalAmount, after: finalAmount, comment: comment || "" });
      updates.editLog = log;
    } else if (comment) {
      const existing = col === "expenses" ? expenses.find(e => e.id === id) : requests.find(r => r.id === id);
      const log = existing?.editLog || [];
      log.push({ date: today(), before: originalAmount, after: finalAmount, comment });
      updates.editLog = log;
    }
    await updateDoc(doc(db, col, id), updates);
  };

  const rejectItem = async (col, id, comment) => {
    const updates = { status: "rejected" };
    if (comment) {
      const existing = col === "expenses" ? expenses.find(e => e.id === id) : requests.find(r => r.id === id);
      const log = existing?.editLog || [];
      const item = existing;
      log.push({ date: today(), before: item?.amount, after: item?.amount, comment: `REJECTED: ${comment}` });
      updates.editLog = log;
    }
    await updateDoc(doc(db, col, id), updates);
  };

  // CHANGE 3: Delete expense
  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "expenses", id));
  };

  // CHANGE 4: Save reserved fund
  const saveReservedFund = async (amount) => {
    await setDoc(doc(db, "meta", "admin"), { reservedFund: amount }, { merge: true });
    setReservedFund(amount);
  };

  const pendingReqCount = requests.filter(r => r.status === "pending").length;
  const pendingExpCount = expenses.filter(e => e.status === "pending").length;

  const tabs = isAdmin
    ? [{ id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "requests", label: `Requests${pendingReqCount ? ` (${pendingReqCount})` : ""}`, icon: "📋" }, { id: "expenses", label: `Expenses${pendingExpCount ? ` (${pendingExpCount})` : ""}`, icon: "🧾" }]
    : [{ id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "requests", label: "Fund Requests", icon: "💰" }, { id: "expenses", label: "My Expenses", icon: "🧾" }];

  const filterUI = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      {isAdmin && <select value={filterEngineer} onChange={e => setFilterEngineer(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}><option value="">All Engineers</option>{USERS.filter(u => u.role === "engineer").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}><option value="all">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
      <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}><option value="all">All Time</option><option value="weekly">This Week</option><option value="monthly">This Month</option></select>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'DM Sans', sans-serif" }}>
      {/* NAV */}
      <div style={{ background: "#0F172A", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, overflowX: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 24, height: 58, minWidth: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ fontSize: 22 }}>⚡</div><span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>FieldExpense</span></div>
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setFilterStatus("all"); setFilterPeriod("all"); setFilterEngineer(""); }} style={{ background: tab === t.id ? "rgba(59,130,246,0.2)" : "none", border: "none", borderRadius: 8, padding: "6px 14px", color: tab === t.id ? "#60A5FA" : "#94A3B8", cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, fontFamily: "'DM Sans', sans-serif" }}>{t.icon} {t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* CHANGE 4: Reserved fund button in nav for admin */}
            {isAdmin && <Button small variant="warning" onClick={() => setShowReservedModal(true)}>🏦 Reserved Fund</Button>}
            <Avatar user={user} size={32} />
            <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, color: "#94A3B8", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {tab === "dashboard" && (
          <>
            {isAdmin ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Admin Dashboard</h2>
                  <Button variant="warning" onClick={() => setShowReservedModal(true)}>🏦 Set Reserved Fund</Button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
                  {[
                    { label: "Pending Funds", value: requests.filter(r => r.status === "pending").length, icon: "⏳", color: "#D97706" },
                    { label: "Pending Expenses", value: expenses.filter(r => r.status === "pending").length, icon: "📋", color: "#EF4444" },
                    { label: "Total Disbursed", value: fmt(requests.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0)), icon: "💰", color: "#065F46" },
                  ].map(s => <Card key={s.label} style={{ padding: "18px 20px" }}><div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div><div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{s.label}</div></Card>)}
                </div>
                <AdminSummary expenses={expenses} requests={requests} reservedFund={reservedFund} />
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                  <div><h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Welcome, {user.name} 👋</h2><p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>{user.department}</p></div>
                  <div style={{ display: "flex", gap: 10 }}><Button onClick={() => setShowFundForm(true)} variant="outline">💰 Request Funds</Button><Button onClick={() => { setEditExpense(null); setShowExpenseForm(true); }} disabled={availableBalance <= 0}>🧾 Add Expense</Button></div>
                </div>

                <Card style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>📒 My Ledger</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Approved Funds", value: fmt(approvedFunds), color: "#10B981", icon: "💰" },
                      { label: "Approved Expenses", value: fmt(approvedExpenses), color: "#EF4444", icon: "🧾" },
                      { label: "Available Balance", value: fmt(availableBalance), color: availableBalance < 0 ? "#EF4444" : "#1E40AF", icon: "📊" },
                    ].map(item => (
                      <div key={item.label} style={{ background: "#F9FAFB", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Recent Expenses</h3><Button small variant="ghost" onClick={() => setTab("expenses")}>View all →</Button></div>
                  <ExpenseList expenses={myExpenses.slice(0, 5)} onEdit={e => { setEditExpense(e); setShowExpenseForm(true); }} onViewAttachment={setViewAttachment} onDelete={setDeleteItem} filter={{ period: "all", status: "all", engineer: "" }} />
                </Card>
              </>
            )}
          </>
        )}

        {tab === "requests" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Fund Requests</h2>{!isAdmin && <Button onClick={() => setShowFundForm(true)}>💰 New Request</Button>}</div>
            {filterUI}
            <Card><RequestList requests={requests} isAdmin={isAdmin} engineerId={user.id} filter={{ status: filterStatus, period: filterPeriod, engineer: filterEngineer }} onReview={req => setReviewItem(req)} /></Card>
          </>
        )}

        {tab === "expenses" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}><h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{isAdmin ? "All Expenses" : "My Expenses"}</h2>{!isAdmin && <Button onClick={() => { setEditExpense(null); setShowExpenseForm(true); }} disabled={availableBalance <= 0}>🧾 Add Expense</Button>}</div>
            {filterUI}
            <Card><ExpenseList expenses={isAdmin ? expenses : myExpenses} onEdit={e => { setEditExpense(e); setShowExpenseForm(true); }} onViewAttachment={setViewAttachment} onReview={exp => setReviewItem(exp)} onDelete={setDeleteItem} isAdmin={isAdmin} filter={{ status: filterStatus, period: filterPeriod, engineer: filterEngineer }} /></Card>
          </>
        )}
      </div>

      {showFundForm && <FundRequestForm user={user} onSubmit={addRequest} onClose={() => setShowFundForm(false)} />}
      {showExpenseForm && <ExpenseForm user={user} availableBalance={editExpense ? availableBalance + editExpense.amount : availableBalance} onSubmit={addExpense} onClose={() => { setShowExpenseForm(false); setEditExpense(null); }} editItem={editExpense} />}

      {reviewItem && (
        <AdminReviewModal
          item={reviewItem}
          type={reviewItem.type}
          onClose={() => setReviewItem(null)}
          onApprove={(id, amt, comment, origAmt) => approveItem(reviewItem.type === "expense" ? "expenses" : "requests", id, amt, comment, origAmt)}
          onReject={(id, comment) => rejectItem(reviewItem.type === "expense" ? "expenses" : "requests", id, comment)}
        />
      )}

      {deleteItem && <ConfirmDeleteModal item={deleteItem} onConfirm={deleteExpense} onClose={() => setDeleteItem(null)} />}

      {showReservedModal && <ReservedFundModal currentReserved={reservedFund} onSave={saveReservedFund} onClose={() => setShowReservedModal(false)} />}

      {viewAttachment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><strong style={{ fontSize: 15 }}>{viewAttachment.attachName}</strong></div>
              <button onClick={() => setViewAttachment(null)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 20, textAlign: "center" }}>
              {viewAttachment.attachment.startsWith("data:image") ? <img src={viewAttachment.attachment} alt="receipt" style={{ maxWidth: "100%", borderRadius: 8 }} /> : <iframe src={viewAttachment.attachment} style={{ width: "100%", height: 500, border: "none" }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
