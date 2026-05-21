import { useState, useEffect, useRef } from "react";
import {
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().split("T")[0];
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");
const initials = (name) => name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: "admin", name: "Admin", role: "admin", password: "admin123", avatar: "A", department: "" },
  { id: "eng1", name: "Arjun Menon", role: "engineer", password: "eng123", avatar: "AM", department: "South Kerala" },
  { id: "eng2", name: "Priya Nair", role: "engineer", password: "eng456", avatar: "PN", department: "North Kerala" },
  { id: "eng3", name: "Rahul Das", role: "engineer", password: "eng789", avatar: "RD", department: "Central Kerala" },
];

const STATUS_COLORS = {
  pending: { fg: "#F59E0B", bg: "#FEF3C7", label: "Pending" },
  approved: { fg: "#10B981", bg: "#D1FAE5", label: "Approved" },
  rejected: { fg: "#EF4444", bg: "#FEE2E2", label: "Rejected" },
  issued: { fg: "#3B82F6", bg: "#EFF6FF", label: "Issued" },
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const G = {
  bg: "#0B0F1A",
  card: "#111827",
  cardBorder: "#1F2937",
  accent: "#F97316",
  accent2: "#3B82F6",
  green: "#10B981",
  red: "#EF4444",
  yellow: "#F59E0B",
  text: "#F9FAFB",
  muted: "#6B7280",
  subtle: "#374151",
  inputBg: "#1F2937",
};

const css = {
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${G.cardBorder}`,
    fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", background: G.inputBg, color: G.text,
    boxSizing: "border-box", outline: "none",
  },
  card: {
    background: G.card, borderRadius: 16, border: `1px solid ${G.cardBorder}`,
    boxShadow: "0 2px 16px rgba(0,0,0,0.4)", padding: 20,
  },
  label: {
    display: "block", fontSize: 10, fontWeight: 700, color: G.muted, marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'IBM Plex Mono', monospace",
  },
};

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ ...css.card, ...style }}>{children}</div>;
}

function Btn({ children, onClick, variant = "primary", disabled, sm, style }) {
  const variants = {
    primary: { background: `linear-gradient(135deg, #EA580C, #F97316)`, color: "#fff" },
    blue: { background: `linear-gradient(135deg, #1D4ED8, #3B82F6)`, color: "#fff" },
    green: { background: `linear-gradient(135deg, #065F46, #10B981)`, color: "#fff" },
    danger: { background: `linear-gradient(135deg, #991B1B, #EF4444)`, color: "#fff" },
    ghost: { background: G.subtle, color: G.text },
    outline: { background: "transparent", color: G.accent, border: `1.5px solid ${G.accent}` },
    outlineBlue: { background: "transparent", color: G.accent2, border: `1.5px solid ${G.accent2}` },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        border: "none", borderRadius: sm ? 8 : 10, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: sm ? 11 : 13,
        padding: sm ? "5px 12px" : "10px 20px", opacity: disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.15s",
        ...variants[variant], ...style,
      }}
    >{children}</button>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={css.label}>{label}</label>
      {children}
    </div>
  );
}

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      color: c.fg, background: c.bg, fontFamily: "'IBM Plex Mono', monospace",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>{c.label}</span>
  );
}

function Avatar({ name, size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #EA580C, #7C3AED)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.33,
      fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0,
    }}>{initials(name)}</div>
  );
}

function StatCard({ icon, label, value, color = G.accent, sub }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: G.muted, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: G.subtle, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 0", color: G.muted, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
      <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>{icon}</div>
      <div>{text}</div>
    </div>
  );
}

// ─── PRODUCT SEARCH DROPDOWN ───────────────────────────────────────────────────
function ProductDropdown({ value, onChange, products, placeholder = "Search product..." }) {
  const [q, setQ] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.productId.toLowerCase().includes(q.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(q.toLowerCase())
  );

  const select = (p) => { onChange(p); setQ(`[${p.productId}] ${p.name}`); setOpen(false); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={css.input}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 600,
          background: G.card, border: `1.5px solid ${G.cardBorder}`, borderRadius: 10,
          maxHeight: 220, overflowY: "auto", marginTop: 4,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => select(p)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${G.cardBorder}`, display: "flex", gap: 10, alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = G.subtle}
              onMouseLeave={e => e.currentTarget.style.background = ""}
            >
              <span style={{ fontSize: 10, color: G.accent, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{p.productId}</span>
              <span style={{ flex: 1, color: G.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{p.name}</span>
              <span style={{ fontSize: 10, color: G.muted }}>{p.category}</span>
              <span style={{ fontSize: 11, color: G.green, fontWeight: 700 }}>Stock: {p.mainStock || 0}</span>
            </div>
          ))}
        </div>
      )}
      {open && q && filtered.length === 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 600, background: G.card, border: `1.5px solid ${G.cardBorder}`, borderRadius: 10, padding: "12px 14px", color: G.muted, fontSize: 12, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
          No products match "{q}"
        </div>
      )}
    </div>
  );
}

// ─── PRODUCT UTILITY CARD ─────────────────────────────────────────────────────
function ProductUtilityCard({ product, utilityRecords, engineers, onClose }) {
  if (!product) return null;
  const records = utilityRecords.filter(r => r.productId === product.id);
  const totalUsed = records.reduce((s, r) => s + (r.qty || 0), 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <div style={{ ...css.card, width: "100%", maxWidth: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, color: G.accent, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, marginBottom: 4 }}>PRODUCT UTILITY CARD</div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: G.text, fontFamily: "'IBM Plex Mono', monospace" }}>{product.name}</h3>
            <div style={{ fontSize: 12, color: G.muted, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>ID: {product.productId} · {product.category || "Uncategorized"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20, flexShrink: 0 }}>
          {[
            { label: "Main Stock", value: product.mainStock || 0, color: G.accent2 },
            { label: "Total Issued", value: totalUsed, color: G.yellow },
            { label: "Unit", value: product.unit || "pcs", color: G.muted },
            { label: "Records", value: records.length, color: G.green },
          ].map(s => (
            <div key={s.label} style={{ background: G.inputBg, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: G.muted, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Records table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {records.length === 0 ? (
            <EmptyState icon="📋" text="No utility records for this product" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${G.cardBorder}` }}>
                  {["Service ID", "Date", "Engineer", "Qty Used", "Customer/Site", "Remarks"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", color: G.muted, fontWeight: 700, textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
                  const eng = engineers.find(e => e.id === r.engineerId);
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${G.cardBorder}` }}
                      onMouseEnter={e => e.currentTarget.style.background = G.inputBg}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                    >
                      <td style={{ padding: "10px 10px", color: G.accent, fontWeight: 700 }}>{r.serviceId || "—"}</td>
                      <td style={{ padding: "10px 10px", color: G.muted }}>{r.date}</td>
                      <td style={{ padding: "10px 10px", color: G.text }}>{eng?.name || r.engineerName || "—"}</td>
                      <td style={{ padding: "10px 10px", color: G.yellow, fontWeight: 700 }}>{r.qty} {product.unit || "pcs"}</td>
                      <td style={{ padding: "10px 10px", color: G.muted }}>{r.customer || "—"}</td>
                      <td style={{ padding: "10px 10px", color: G.muted }}>{r.remarks || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, users }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const handle = () => {
    const u = users.find(u => u.id === id && u.password === pw);
    if (u) onLogin(u); else setErr("Invalid credentials");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: G.bg, fontFamily: "'IBM Plex Mono', monospace" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #EA580C, #7C3AED)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>🔧</div>
          <h1 style={{ color: G.text, fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>SpareTrack</h1>
          <p style={{ color: G.muted, fontSize: 12, margin: 0 }}>Field Spare Parts Management</p>
        </div>
        <Card>
          <Field label="User ID">
            <select value={id} onChange={e => setId(e.target.value)} style={css.input}>
              <option value="">Select user...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </Field>
          <Field label="Password">
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="Enter password" style={css.input} />
          </Field>
          {err && <p style={{ color: G.red, fontSize: 12, margin: "0 0 12px" }}>{err}</p>}
          <Btn onClick={handle} disabled={!id || !pw} style={{ width: "100%" }}>Sign In →</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 360 }}>
        <h3 style={{ margin: "0 0 10px", color: G.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{title}</h3>
        <p style={{ fontSize: 13, color: G.muted, margin: "0 0 20px", fontFamily: "'IBM Plex Mono', monospace" }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={() => { onConfirm(); onClose(); }} variant="danger" style={{ flex: 1 }}>Confirm</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── PRODUCT FORM ─────────────────────────────────────────────────────────────
function ProductForm({ editItem, onSave, onClose }) {
  const [productId, setProductId] = useState(editItem?.productId || "");
  const [name, setName] = useState(editItem?.name || "");
  const [category, setCategory] = useState(editItem?.category || "");
  const [unit, setUnit] = useState(editItem?.unit || "pcs");
  const [description, setDescription] = useState(editItem?.description || "");

  const submit = () => {
    if (!productId.trim() || !name.trim()) return;
    onSave({ id: editItem?.id || uid(), productId: productId.trim(), name: name.trim(), category: category.trim(), unit: unit.trim(), description: description.trim(), mainStock: editItem?.mainStock || 0 });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: G.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>🔩 {editItem ? "Edit Product" : "Add Product"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Product ID *"><input value={productId} onChange={e => setProductId(e.target.value)} placeholder="e.g. SPN-001" style={css.input} /></Field>
          <Field label="Unit"><input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs / m / kg" style={css.input} /></Field>
        </div>
        <Field label="Product Name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Full product name" style={css.input} /></Field>
        <Field label="Category"><input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Cable, Tool, Component" style={css.input} /></Field>
        <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional notes" style={{ ...css.input, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={submit} disabled={!productId || !name} style={{ flex: 1 }}>{editItem ? "Update" : "Add Product"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── STOCK MOVEMENT FORM ──────────────────────────────────────────────────────
function StockMovementForm({ products, type, onSave, onClose }) {
  const [selProduct, setSelProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(today());
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");

  const isInward = type === "inward";

  const submit = () => {
    if (!selProduct || !qty) return;
    onSave({ id: uid(), productId: selProduct.id, productName: selProduct.name, pidCode: selProduct.productId, qty: parseInt(qty), type, date, remarks, supplier, invoiceNo, createdAt: today() });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: G.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>
            {isInward ? "📥 Stock Inward" : "📤 Stock Outward"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <Field label="Select Product">
          <ProductDropdown value="" onChange={setSelProduct} products={products} />
        </Field>
        {selProduct && (
          <div style={{ background: G.inputBg, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: G.muted, fontFamily: "'IBM Plex Mono', monospace', display:'flex", gap: 10 }}>
            <span style={{ color: G.accent, fontWeight: 700 }}>{selProduct.productId}</span> · {selProduct.name} · Current Stock: <span style={{ color: G.green, fontWeight: 700 }}>{selProduct.mainStock || 0} {selProduct.unit}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Quantity"><input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" style={css.input} min="1" /></Field>
          <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={css.input} /></Field>
        </div>
        {isInward && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Supplier"><input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" style={css.input} /></Field>
            <Field label="Invoice No."><input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-XXXX" style={css.input} /></Field>
          </div>
        )}
        <Field label="Remarks"><input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes" style={css.input} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={submit} disabled={!selProduct || !qty} variant={isInward ? "green" : "blue"} style={{ flex: 1 }}>
            {isInward ? "📥 Record Inward" : "📤 Record Outward"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── SPARE REQUEST FORM (Engineer) ────────────────────────────────────────────
function SpareRequestForm({ user, products, onSave, onClose }) {
  const [selProduct, setSelProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customer, setCustomer] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(today());

  const submit = () => {
    if (!selProduct || !qty || !serviceId) return;
    onSave({
      id: uid(), productId: selProduct.id, productName: selProduct.name, pidCode: selProduct.productId,
      qty: parseInt(qty), engineerId: user.id, engineerName: user.name,
      serviceId, customer, remarks, date, status: "pending", type: "spare_request", createdAt: today(),
    });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16, overflowY: "auto" }}>
      <Card style={{ width: "100%", maxWidth: 500, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: G.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>🔧 Request Spare Part</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <Field label="Select Product">
          <ProductDropdown value="" onChange={setSelProduct} products={products} placeholder="Search by name or product ID..." />
        </Field>
        {selProduct && (
          <div style={{ background: G.inputBg, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ color: G.accent, fontWeight: 700 }}>{selProduct.productId}</span> · {selProduct.name}
            <span style={{ float: "right", color: selProduct.mainStock > 0 ? G.green : G.red, fontWeight: 700 }}>Stock: {selProduct.mainStock || 0}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Service ID *"><input value={serviceId} onChange={e => setServiceId(e.target.value)} placeholder="SVC-XXXX" style={css.input} /></Field>
          <Field label="Quantity *"><input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" style={css.input} min="1" /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Customer / Site"><input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" style={css.input} /></Field>
          <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={css.input} /></Field>
        </div>
        <Field label="Remarks"><input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Purpose / notes" style={css.input} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={submit} disabled={!selProduct || !qty || !serviceId} style={{ flex: 1 }}>Submit Request</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── UTILITY RECORD FORM (Engineer — log usage) ───────────────────────────────
function UtilityRecordForm({ user, engineerStock, products, onSave, onClose }) {
  const [selProduct, setSelProduct] = useState(null);
  const [qty, setQty] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [customer, setCustomer] = useState("");
  const [remarks, setRemarks] = useState("");
  const [date, setDate] = useState(today());

  // Only products available in engineer's stock
  const myStock = engineerStock.filter(s => s.engineerId === user.id && s.qty > 0);
  const availableProducts = products.filter(p => myStock.some(s => s.productId === p.id));

  const myQty = selProduct ? (myStock.find(s => s.productId === selProduct.id)?.qty || 0) : 0;
  const over = parseInt(qty) > myQty;

  const submit = () => {
    if (!selProduct || !qty || !serviceId || over) return;
    onSave({
      id: uid(), productId: selProduct.id, productName: selProduct.name, pidCode: selProduct.productId,
      qty: parseInt(qty), engineerId: user.id, engineerName: user.name,
      serviceId, customer, remarks, date, createdAt: today(),
    });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16, overflowY: "auto" }}>
      <Card style={{ width: "100%", maxWidth: 500, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: G.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>⚙️ Log Utility (Usage)</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: G.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {availableProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: G.muted, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
            No parts in your stock. Request spares first.
          </div>
        ) : (
          <>
            <Field label="Select Product (from your stock)">
              <ProductDropdown value="" onChange={setSelProduct} products={availableProducts} placeholder="Search your stock..." />
            </Field>
            {selProduct && (
              <div style={{ background: G.inputBg, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                <span style={{ color: G.accent, fontWeight: 700 }}>{selProduct.productId}</span> · {selProduct.name}
                <span style={{ float: "right", color: G.accent2, fontWeight: 700 }}>Your Stock: {myQty}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Service ID *"><input value={serviceId} onChange={e => setServiceId(e.target.value)} placeholder="SVC-XXXX" style={css.input} /></Field>
              <Field label="Qty Used *">
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" style={{ ...css.input, borderColor: over ? G.red : undefined }} min="1" />
                {over && <span style={{ color: G.red, fontSize: 11 }}>⚠ Exceeds your stock</span>}
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Customer / Site"><input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name" style={css.input} /></Field>
              <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={css.input} /></Field>
            </div>
            <Field label="Remarks"><input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Notes" style={css.input} /></Field>
          </>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={submit} disabled={!selProduct || !qty || !serviceId || over || availableProducts.length === 0} variant="blue" style={{ flex: 1 }}>Log Usage</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── ADMIN REVIEW MODAL ───────────────────────────────────────────────────────
function ReviewModal({ item, products, onApprove, onReject, onClose }) {
  const product = products.find(p => p.id === item.productId);
  const [qty, setQty] = useState(item.qty);
  const [note, setNote] = useState("");
  const availableStock = product?.mainStock || 0;
  const notEnough = parseInt(qty) > availableStock;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 440 }}>
        <h3 style={{ margin: "0 0 16px", color: G.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>🔍 Review Spare Request</h3>
        <div style={{ background: G.inputBg, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace', lineHeight: 2 }}>
          <div><span style={{ color: G.muted }}>Engineer: </span><span style={{ color: G.text }}>{item.engineerName}</span></div>
          <div><span style={{ color: G.muted }}>Product: </span><span style={{ color: G.accent, fontWeight: 700 }}>[{item.pidCode}]</span> {item.productName}</div>
          <div><span style={{ color: G.muted }}>Service ID: </span><span style={{ color: G.accent2, fontWeight: 700 }}>{item.serviceId}</span></div>
          <div><span style={{ color: G.muted }}>Customer: </span><span style={{ color: G.text }}>{item.customer || "—"}</span></div>
          <div><span style={{ color: G.muted }}>Date: </span><span style={{ color: G.text }}>{item.date}</span></div>
          <div><span style={{ color: G.muted }}>Main Stock: </span><span style={{ color: availableStock > 0 ? G.green : G.red, fontWeight: 700 }}>{availableStock}</span></div>
        </div>
        <Field label="Approve Quantity">
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{ ...css.input, borderColor: notEnough ? G.red : undefined }} />
          {notEnough && <span style={{ color: G.red, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>⚠ Exceeds main stock ({availableStock})</span>}
        </Field>
        <Field label="Note (optional)">
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...css.input, resize: "vertical" }} />
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Btn>
          <Btn onClick={() => { onReject(item.id, note); onClose(); }} variant="danger">Reject</Btn>
          <Btn onClick={() => { onApprove(item.id, parseInt(qty), note); onClose(); }} variant="green" disabled={notEnough || !qty}>Approve & Issue</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN STORE (Admin) ───────────────────────────────────────────────────────
function MainStore({ products, movements, onSaveProduct, onDeleteProduct, onRecordMovement, onViewUtilityCard }) {
  const [subTab, setSubTab] = useState("stock");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showInward, setShowInward] = useState(false);
  const [showOutward, setShowOutward] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [selUtilityProduct, setSelUtilityProduct] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.productId.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = products.length;
  const totalInward = movements.filter(m => m.type === "inward").reduce((s, m) => s + m.qty, 0);
  const totalOutward = movements.filter(m => m.type === "outward").reduce((s, m) => s + m.qty, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: G.text, fontFamily: "'IBM Plex Mono', monospace" }}>🏭 Main Store</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: G.muted, fontFamily: "'IBM Plex Mono', monospace" }}>Stock, inwards & outwards management</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="green" onClick={() => setShowInward(true)}>📥 Inward</Btn>
          <Btn variant="blue" onClick={() => setShowOutward(true)}>📤 Outward</Btn>
          <Btn onClick={() => { setEditProduct(null); setShowProductForm(true); }}>+ Product</Btn>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon="🔩" label="Total Products" value={totalItems} color={G.accent} />
        <StatCard icon="📥" label="Total Inward" value={fmt(totalInward)} color={G.green} />
        <StatCard icon="📤" label="Total Outward" value={fmt(totalOutward)} color={G.accent2} />
        <StatCard icon="⚠️" label="Low Stock" value={products.filter(p => (p.mainStock || 0) < 5).length} color={G.red} sub="< 5 units" />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["stock", "📦 Stock"], ["inward", "📥 Inward Log"], ["outward", "📤 Outward Log"]].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12,
            background: subTab === id ? G.accent : G.subtle, color: subTab === id ? "#fff" : G.muted,
          }}>{label}</button>
        ))}
      </div>

      {/* Stock tab */}
      {subTab === "stock" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products..." style={{ ...css.input, maxWidth: 380 }} />
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {filtered.length === 0 ? <EmptyState icon="📦" text="No products found" /> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: G.inputBg }}>
                    {["Product ID", "Name", "Category", "Unit", "Main Stock", "Actions"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", color: G.muted, fontWeight: 700, textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} style={{ borderTop: `1px solid ${G.cardBorder}` }}
                      onMouseEnter={e => e.currentTarget.style.background = G.inputBg}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                    >
                      <td style={{ padding: "12px 14px", color: G.accent, fontWeight: 700 }}>{p.productId}</td>
                      <td style={{ padding: "12px 14px", color: G.text }}>{p.name}</td>
                      <td style={{ padding: "12px 14px", color: G.muted }}>{p.category || "—"}</td>
                      <td style={{ padding: "12px 14px", color: G.muted }}>{p.unit || "pcs"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ color: (p.mainStock || 0) < 5 ? G.red : G.green, fontWeight: 700 }}>{p.mainStock || 0}</span>
                        {(p.mainStock || 0) < 5 && <span style={{ marginLeft: 6, fontSize: 10, color: G.red }}>⚠ Low</span>}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Btn sm variant="outlineBlue" onClick={() => onViewUtilityCard(p)}>📋 Card</Btn>
                          <Btn sm variant="outline" onClick={() => { setEditProduct(p); setShowProductForm(true); }}>✏️</Btn>
                          <Btn sm variant="danger" onClick={() => setConfirm({ onConfirm: () => onDeleteProduct(p.id), message: `Delete "${p.name}"?` })}>🗑️</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {/* Inward log */}
      {subTab === "inward" && (
        <Card>
          {movements.filter(m => m.type === "inward").length === 0 ? <EmptyState icon="📥" text="No inward records" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {movements.filter(m => m.type === "inward").sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => (
                <div key={m.id} style={{ padding: "12px 14px", background: G.inputBg, borderRadius: 10, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: G.green, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: G.text, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{m.productName} <span style={{ color: G.accent, fontSize: 11 }}>[{m.pidCode}]</span></div>
                    <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{m.date}{m.supplier ? ` · ${m.supplier}` : ""}{m.invoiceNo ? ` · ${m.invoiceNo}` : ""}</div>
                  </div>
                  <div style={{ color: G.green, fontWeight: 800, fontSize: 15, fontFamily: "'IBM Plex Mono', monospace" }}>+{m.qty}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Outward log */}
      {subTab === "outward" && (
        <Card>
          {movements.filter(m => m.type === "outward").length === 0 ? <EmptyState icon="📤" text="No outward records" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {movements.filter(m => m.type === "outward").sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => (
                <div key={m.id} style={{ padding: "12px 14px", background: G.inputBg, borderRadius: 10, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: G.accent2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: G.text, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{m.productName} <span style={{ color: G.accent, fontSize: 11 }}>[{m.pidCode}]</span></div>
                    <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{m.date}{m.remarks ? ` · ${m.remarks}` : ""}</div>
                  </div>
                  <div style={{ color: G.accent2, fontWeight: 800, fontSize: 15, fontFamily: "'IBM Plex Mono', monospace" }}>-{m.qty}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {showProductForm && <ProductForm editItem={editProduct} onSave={onSaveProduct} onClose={() => { setShowProductForm(false); setEditProduct(null); }} />}
      {showInward && <StockMovementForm products={products} type="inward" onSave={onRecordMovement} onClose={() => setShowInward(false)} />}
      {showOutward && <StockMovementForm products={products} type="outward" onSave={onRecordMovement} onClose={() => setShowOutward(false)} />}
      {confirm && <ConfirmModal title="Confirm Delete" message={confirm.message} onConfirm={confirm.onConfirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ─── ADMIN REQUESTS PANEL ─────────────────────────────────────────────────────
function AdminRequests({ requests, products, engineers, onApprove, onReject }) {
  const [reviewItem, setReviewItem] = useState(null);
  const [filterEng, setFilterEng] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = requests.filter(r => {
    if (filterEng && r.engineerId !== filterEng) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: G.text, fontFamily: "'IBM Plex Mono', monospace" }}>📋 Spare Requests</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: G.muted, fontFamily: "'IBM Plex Mono', monospace" }}>Review and approve engineer spare part requests</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filterEng} onChange={e => setFilterEng(e.target.value)} style={{ ...css.input, width: "auto", padding: "8px 14px" }}>
          <option value="">All Engineers</option>
          {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...css.input, width: "auto", padding: "8px 14px" }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Pending", count: requests.filter(r => r.status === "pending").length, color: G.yellow },
          { label: "Approved", count: requests.filter(r => r.status === "approved").length, color: G.green },
          { label: "Rejected", count: requests.filter(r => r.status === "rejected").length, color: G.red },
        ].map(s => (
          <Card key={s.label} style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.count}</div>
              <div style={{ fontSize: 10, color: G.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon="📋" text="No requests found" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(req => (
              <div key={req.id} style={{ padding: "14px 16px", background: G.inputBg, borderRadius: 12, border: `1px solid ${G.cardBorder}` }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar name={req.engineerName} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ color: G.text, fontWeight: 700, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{req.engineerName}</span>
                      <span style={{ color: G.accent2, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>SVC: {req.serviceId}</span>
                      <Badge status={req.status} />
                    </div>
                    <div style={{ color: G.accent, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>[{req.pidCode}] {req.productName}</div>
                    <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginTop: 3 }}>
                      Qty: <span style={{ color: G.yellow, fontWeight: 700 }}>{req.qty}</span>
                      {req.customer && <> · Customer: {req.customer}</>}
                      {" "}· {req.date}
                    </div>
                    {req.remarks && <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2, fontStyle: "italic" }}>{req.remarks}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {req.status === "pending" && <Btn sm variant="primary" onClick={() => setReviewItem(req)}>Review</Btn>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {reviewItem && <ReviewModal item={reviewItem} products={products} onApprove={onApprove} onReject={onReject} onClose={() => setReviewItem(null)} />}
    </div>
  );
}

// ─── ADMIN UTILITY VIEW ───────────────────────────────────────────────────────
function AdminUtility({ utilityRecords, products, engineers }) {
  const [filterEng, setFilterEng] = useState("");
  const [filterProduct, setFilterProduct] = useState(null);
  const [viewCard, setViewCard] = useState(null);

  const filtered = utilityRecords.filter(r => {
    if (filterEng && r.engineerId !== filterEng) return false;
    if (filterProduct && r.productId !== filterProduct.id) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: G.text, fontFamily: "'IBM Plex Mono', monospace" }}>⚙️ Utility Records</h2>
        <p style={{ margin: 0, fontSize: 12, color: G.muted, fontFamily: "'IBM Plex Mono', monospace" }}>All spare part usage logs across engineers</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <select value={filterEng} onChange={e => setFilterEng(e.target.value)} style={{ ...css.input, width: "auto", padding: "8px 14px" }}>
          <option value="">All Engineers</option>
          {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div style={{ minWidth: 280 }}>
          <ProductDropdown value="" onChange={setFilterProduct} products={products} placeholder="Filter by product..." />
        </div>
        {(filterEng || filterProduct) && (
          <Btn sm variant="ghost" onClick={() => { setFilterEng(""); setFilterProduct(null); }}>✕ Clear</Btn>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        <StatCard icon="📦" label="Total Entries" value={filtered.length} color={G.accent} />
        <StatCard icon="🔧" label="Total Qty Used" value={fmt(filtered.reduce((s, r) => s + r.qty, 0))} color={G.yellow} />
        <StatCard icon="👷" label="Active Engineers" value={new Set(filtered.map(r => r.engineerId)).size} color={G.accent2} />
      </div>

      <Card>
        {filtered.length === 0 ? <EmptyState icon="⚙️" text="No utility records found" /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
            <thead>
              <tr style={{ background: G.inputBg }}>
                {["Service ID", "Date", "Engineer", "Product", "Qty", "Customer", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", color: G.muted, fontWeight: 700, textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const product = products.find(p => p.id === r.productId);
                const eng = engineers.find(e => e.id === r.engineerId);
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${G.cardBorder}` }}
                    onMouseEnter={e => e.currentTarget.style.background = G.inputBg}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                  >
                    <td style={{ padding: "10px 12px", color: G.accent2, fontWeight: 700 }}>{r.serviceId || "—"}</td>
                    <td style={{ padding: "10px 12px", color: G.muted }}>{r.date}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Avatar name={eng?.name || r.engineerName} size={24} />
                        <span style={{ color: G.text }}>{eng?.name || r.engineerName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: G.accent, fontWeight: 700 }}>[{r.pidCode}]</span> <span style={{ color: G.text }}>{r.productName}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: G.yellow, fontWeight: 700 }}>{r.qty}</td>
                    <td style={{ padding: "10px 12px", color: G.muted }}>{r.customer || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {product && <Btn sm variant="outlineBlue" onClick={() => setViewCard(product)}>📋 Card</Btn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {viewCard && <ProductUtilityCard product={viewCard} utilityRecords={utilityRecords} engineers={engineers} onClose={() => setViewCard(null)} />}
    </div>
  );
}

// ─── ENGINEER DASHBOARD ───────────────────────────────────────────────────────
function EngineerDashboard({ user, products, engineerStock, spareRequests, utilityRecords, onNewRequest, onLogUtility, onViewUtilityCard }) {
  const myStock = engineerStock.filter(s => s.engineerId === user.id && s.qty > 0);
  const myRequests = spareRequests.filter(r => r.engineerId === user.id);
  const myUtility = utilityRecords.filter(r => r.engineerId === user.id);
  const [subTab, setSubTab] = useState("stock");

  const totalInHand = myStock.reduce((s, i) => s + i.qty, 0);
  const totalUsed = myUtility.reduce((s, r) => s + r.qty, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: G.text, fontFamily: "'IBM Plex Mono', monospace" }}>Welcome, {user.name} 👷</h2>
          <p style={{ margin: 0, fontSize: 12, color: G.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{user.department || "Field Engineer"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={onNewRequest}>🔧 Request Spare</Btn>
          <Btn variant="blue" onClick={onLogUtility} disabled={myStock.length === 0}>⚙️ Log Usage</Btn>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard icon="📦" label="Parts In Hand" value={totalInHand} color={G.green} sub="current stock" />
        <StatCard icon="🔧" label="Total Used" value={totalUsed} color={G.yellow} sub="lifetime" />
        <StatCard icon="⏳" label="Pending Requests" value={myRequests.filter(r => r.status === "pending").length} color={G.red} />
        <StatCard icon="✅" label="Approved Requests" value={myRequests.filter(r => r.status === "approved").length} color={G.accent2} />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["stock", "📦 My Stock"], ["requests", "📋 My Requests"], ["utilised", "⚙️ Utilised"]].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12,
            background: subTab === id ? G.accent : G.subtle, color: subTab === id ? "#fff" : G.muted,
          }}>{label}</button>
        ))}
      </div>

      {/* MY STOCK */}
      {subTab === "stock" && (
        <Card>
          {myStock.length === 0 ? <EmptyState icon="📦" text="No parts in your stock. Request spares from admin." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myStock.map(s => {
                const product = products.find(p => p.id === s.productId);
                return product ? (
                  <div key={s.productId} style={{ padding: "12px 16px", background: G.inputBg, borderRadius: 12, display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#EA580C33,#7C3AED33)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔩</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: G.accent, fontWeight: 700, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{product.productId}</div>
                      <div style={{ color: G.text, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{product.name}</div>
                      <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{product.category || "—"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: G.green, fontWeight: 800, fontSize: 18, fontFamily: "'IBM Plex Mono', monospace" }}>{s.qty}</div>
                      <div style={{ color: G.muted, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>{product.unit || "pcs"}</div>
                    </div>
                    <Btn sm variant="outlineBlue" onClick={() => onViewUtilityCard(product)}>📋</Btn>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </Card>
      )}

      {/* MY REQUESTS */}
      {subTab === "requests" && (
        <Card>
          {myRequests.length === 0 ? <EmptyState icon="📋" text="No spare requests yet" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
                <div key={req.id} style={{ padding: "12px 16px", background: G.inputBg, borderRadius: 12, border: `1px solid ${G.cardBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: G.accent, fontWeight: 700, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>[{req.pidCode}]</span>
                        <span style={{ color: G.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{req.productName}</span>
                        <Badge status={req.status} />
                      </div>
                      <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                        <span style={{ color: G.accent2, fontWeight: 700 }}>SVC: {req.serviceId}</span>
                        {" "}· Qty: <span style={{ color: G.yellow, fontWeight: 700 }}>{req.qty}</span>
                        {req.customer && ` · ${req.customer}`}
                        {" "}· {req.date}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* MY UTILITY */}
      {subTab === "utilised" && (
        <Card>
          {myUtility.length === 0 ? <EmptyState icon="⚙️" text="No utility records yet" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myUtility.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
                const product = products.find(p => p.id === r.productId);
                return (
                  <div key={r.id} style={{ padding: "12px 16px", background: G.inputBg, borderRadius: 12, border: `1px solid ${G.cardBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ color: G.accent2, fontWeight: 700, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>SVC: {r.serviceId}</span>
                          <span style={{ color: G.accent, fontWeight: 700, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>[{r.pidCode}]</span>
                          <span style={{ color: G.text, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{r.productName}</span>
                        </div>
                        <div style={{ color: G.muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                          Qty: <span style={{ color: G.yellow, fontWeight: 700 }}>{r.qty}</span>
                          {r.customer && ` · ${r.customer}`}
                          {" "}· {r.date}
                          {r.remarks && ` · ${r.remarks}`}
                        </div>
                      </div>
                      {product && <Btn sm variant="outlineBlue" onClick={() => onViewUtilityCard(product)}>📋 Card</Btn>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function SparePartsApp() {
  const [user, setUser] = useState(() => { try { const s = localStorage.getItem("spareParts_user"); return s ? JSON.parse(s) : null; } catch { return null; } });
  const handleLogin = (u) => { localStorage.setItem("spareParts_user", JSON.stringify(u)); setUser(u); };
  const handleLogout = () => { localStorage.removeItem("spareParts_user"); setUser(null); };

  const [dbUsers, setDbUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [spareRequests, setSpareRequests] = useState([]);
  const [engineerStock, setEngineerStock] = useState([]);
  const [utilityRecords, setUtilityRecords] = useState([]);

  const [tab, setTab] = useState("dashboard");
  const [showSpareReq, setShowSpareReq] = useState(false);
  const [showUtility, setShowUtility] = useState(false);
  const [viewUtilityCard, setViewUtilityCard] = useState(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "sp_users"), snap => { const u = snap.docs.map(d => d.data()); setDbUsers(u.length > 0 ? u : DEFAULT_USERS); }),
      onSnapshot(collection(db, "sp_products"), snap => setProducts(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "sp_movements"), snap => setMovements(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "sp_requests"), snap => setSpareRequests(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "sp_eng_stock"), snap => setEngineerStock(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "sp_utility"), snap => setUtilityRecords(snap.docs.map(d => d.data()))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (dbUsers.length === 0) DEFAULT_USERS.forEach(u => setDoc(doc(db, "sp_users", u.id), u));
  }, [dbUsers]);

  const allUsers = dbUsers.length > 0 ? dbUsers : DEFAULT_USERS;
  const engineers = allUsers.filter(u => u.role === "engineer");

  if (!user) return <Login onLogin={handleLogin} users={allUsers} />;
  const isAdmin = user.role === "admin";

  // ── Product operations ──
  const saveProduct = async (p) => await setDoc(doc(db, "sp_products", p.id), p);
  const deleteProduct = async (id) => await deleteDoc(doc(db, "sp_products", id));

  // ── Record stock movement + update product main stock ──
  const recordMovement = async (mv) => {
    await setDoc(doc(db, "sp_movements", mv.id), mv);
    const product = products.find(p => p.id === mv.productId);
    if (product) {
      const delta = mv.type === "inward" ? mv.qty : -mv.qty;
      await updateDoc(doc(db, "sp_products", product.id), { mainStock: (product.mainStock || 0) + delta });
    }
  };

  // ── Spare request submit ──
  const submitRequest = async (req) => await setDoc(doc(db, "sp_requests", req.id), req);

  // ── Approve request: deduct main stock, add to engineer stock ──
  const approveRequest = async (reqId, approvedQty, note) => {
    const req = spareRequests.find(r => r.id === reqId);
    if (!req) return;
    await updateDoc(doc(db, "sp_requests", reqId), { status: "approved", approvedQty, note, approvedAt: today() });

    // Deduct from main stock
    const product = products.find(p => p.id === req.productId);
    if (product) await updateDoc(doc(db, "sp_products", product.id), { mainStock: Math.max(0, (product.mainStock || 0) - approvedQty) });

    // Update engineer stock
    const stockKey = `${req.engineerId}_${req.productId}`;
    const existing = engineerStock.find(s => s.engineerId === req.engineerId && s.productId === req.productId);
    await setDoc(doc(db, "sp_eng_stock", stockKey), {
      id: stockKey, engineerId: req.engineerId, engineerName: req.engineerName,
      productId: req.productId, productName: req.productName, pidCode: req.pidCode,
      qty: (existing?.qty || 0) + approvedQty,
    });
  };

  // ── Reject request ──
  const rejectRequest = async (reqId, note) => {
    await updateDoc(doc(db, "sp_requests", reqId), { status: "rejected", note, rejectedAt: today() });
  };

  // ── Log utility (usage): deduct from engineer stock ──
  const logUtility = async (record) => {
    await setDoc(doc(db, "sp_utility", record.id), record);
    const stockKey = `${record.engineerId}_${record.productId}`;
    const existing = engineerStock.find(s => s.engineerId === record.engineerId && s.productId === record.productId);
    if (existing) {
      await updateDoc(doc(db, "sp_eng_stock", stockKey), { qty: Math.max(0, existing.qty - record.qty) });
    }
  };

  const adminTabs = [
    { id: "store", label: "Main Store", icon: "🏭" },
    { id: "requests", label: `Requests${spareRequests.filter(r => r.status === "pending").length ? ` (${spareRequests.filter(r => r.status === "pending").length})` : ""}`, icon: "📋" },
    { id: "utility", label: "Utility Records", icon: "⚙️" },
  ];
  const engTabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
  ];
  const tabs = isAdmin ? adminTabs : engTabs;

  return (
    <div style={{ minHeight: "100vh", background: G.bg, fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* NAV */}
      <div style={{ background: "#0B0F1A", borderBottom: `1px solid ${G.cardBorder}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, height: 56, overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#EA580C,#7C3AED)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔧</div>
            <span style={{ color: G.text, fontWeight: 800, fontSize: 15 }}>SpareTrack</span>
            <span style={{ color: G.muted, fontSize: 10, marginLeft: 4, padding: "2px 8px", borderRadius: 6, border: `1px solid ${G.cardBorder}` }}>FIELD</span>
          </div>
          <div style={{ display: "flex", gap: 2, flex: 1 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? "rgba(249,115,22,0.15)" : "none", border: "none", borderRadius: 8,
                padding: "6px 14px", color: tab === t.id ? G.accent : G.muted, cursor: "pointer",
                fontSize: 12, fontWeight: tab === t.id ? 700 : 500, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap"
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Avatar name={user.name} size={30} />
            <span style={{ color: G.muted, fontSize: 11 }}>{user.name}</span>
            <button onClick={handleLogout} style={{ background: G.subtle, border: "none", borderRadius: 8, color: G.muted, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        {isAdmin ? (
          <>
            {tab === "store" && <MainStore products={products} movements={movements} onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} onRecordMovement={recordMovement} onViewUtilityCard={setViewUtilityCard} />}
            {tab === "requests" && <AdminRequests requests={spareRequests} products={products} engineers={engineers} onApprove={approveRequest} onReject={rejectRequest} />}
            {tab === "utility" && <AdminUtility utilityRecords={utilityRecords} products={products} engineers={engineers} />}
          </>
        ) : (
          <EngineerDashboard
            user={user} products={products} engineerStock={engineerStock}
            spareRequests={spareRequests} utilityRecords={utilityRecords}
            onNewRequest={() => setShowSpareReq(true)}
            onLogUtility={() => setShowUtility(true)}
            onViewUtilityCard={setViewUtilityCard}
          />
        )}
      </div>

      {/* MODALS */}
      {showSpareReq && <SpareRequestForm user={user} products={products} onSave={submitRequest} onClose={() => setShowSpareReq(false)} />}
      {showUtility && <UtilityRecordForm user={user} engineerStock={engineerStock} products={products} onSave={logUtility} onClose={() => setShowUtility(false)} />}
      {viewUtilityCard && <ProductUtilityCard product={viewUtilityCard} utilityRecords={utilityRecords} engineers={engineers} onClose={() => setViewUtilityCard(null)} />}
    </div>
  );
}
