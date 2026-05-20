import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// ─── DATA & HELPERS ──────────────────────────────────────────────────────────
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

const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];
const uid = () => Math.random().toString(36).slice(2, 10);

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_W = 800;
        canvas.width = MAX_W;
        canvas.height = img.height * (MAX_W / img.width);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
  });
};

// ─── UI COMPONENTS ──────────────────────────────────────────────────────────
const Card = ({ children, style }) => <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", padding: 24, ...style }}>{children}</div>;
const Button = ({ children, onClick, variant = "primary", style, small, disabled }) => {
  const base = { border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", padding: small ? "6px 12px" : "10px 20px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1 };
  const variants = { primary: { background: "#1E40AF", color: "#fff" }, success: { background: "#10B981", color: "#fff" }, danger: { background: "#EF4444", color: "#fff" }, ghost: { background: "#F3F4F6", color: "#374151" } };
  return <button style={{ ...base, ...variants[variant], ...style }} onClick={onClick} disabled={disabled}>{children}</button>;
};

// ─── REVIEW MODAL ──────────────────────────────────────────────────────────
function AdminReviewModal({ item, onClose, onAction }) {
  const [amount, setAmount] = useState(item.amount);
  const [comment, setComment] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 400 }}>
        <h3>Review {item.type === 'expense' ? 'Expense' : 'Request'}</h3>
        <p>Requested: {fmt(item.originalAmount || item.amount)}</p>
        <div style={{ marginBottom: 16 }}><label>Final Amount (₹)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: "100%", padding: 8 }} /></div>
        <div style={{ marginBottom: 16 }}><label>Admin Note</label><textarea value={comment} onChange={e => setComment(e.target.value)} style={{ width: "100%", padding: 8 }} /></div>
        <div style={{ display: "flex", gap: 8 }}><Button variant="ghost" onClick={onClose} style={{flex:1}}>Cancel</Button><Button variant="danger" onClick={() => onAction(item.id, "rejected", parseFloat(amount), comment)} style={{flex:1}}>Reject</Button><Button variant="success" onClick={() => onAction(item.id, "approved", parseFloat(amount), comment)} style={{flex:1}}>Approve</Button></div>
      </Card>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("activeUser")));
  const [expenses, setExpenses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reviewItem, setReviewItem] = useState(null);

  useEffect(() => {
    const unsubExp = onSnapshot(collection(db, "expenses"), (s) => setExpenses(s.docs.map(d => d.data())));
    const unsubReq = onSnapshot(collection(db, "requests"), (s) => setRequests(s.docs.map(d => d.data())));
    return () => { unsubExp(); unsubReq(); };
  }, []);

  const handleLogout = () => { localStorage.removeItem("activeUser"); setUser(null); };

  if (!user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
      <Card><h2>Sign In</h2><select onChange={e => { const u = USERS.find(x => x.id === e.target.value); setUser(u); localStorage.setItem("activeUser", JSON.stringify(u)); }}><option>Select User</option>{USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Card>
    </div>
  );

  const isAdmin = user.role === "admin";
  const approvedFunds = requests.filter(r => r.engineerId === user.id && r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const approvedExpenses = expenses.filter(e => e.engineerId === user.id && e.status === "approved").reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>FieldExpense</h1>
        <Button variant="ghost" onClick={handleLogout}>Sign Out</Button>
      </div>
      
      <Card style={{ background: "#EFF6FF", marginBottom: 20 }}>
        <h3>Dashboard</h3>
        <p>Available Balance: <strong>{fmt(approvedFunds - approvedExpenses)}</strong></p>
      </Card>

      <h3>{isAdmin ? "Admin Queue" : "My History"}</h3>
      {[...requests, ...expenses].filter(i => isAdmin || i.engineerId === user.id).sort((a,b) => b.date.localeCompare(a.date)).map(i => (
        <Card key={i.id} style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{i.type.toUpperCase()}: {fmt(i.amount)}</span>
            <span style={{ fontWeight: 700, color: i.status === "approved" ? "green" : i.status === "rejected" ? "red" : "orange" }}>{i.status.toUpperCase()}</span>
          </div>
          {i.isEdited && <p style={{ fontSize: 12, color: "blue" }}>⚠️ Amount adjusted by Admin</p>}
          {i.adminComment && <p style={{ fontSize: 12, color: "red" }}>Admin Note: {i.adminComment}</p>}
          {isAdmin && i.status === "pending" && <Button onClick={() => setReviewItem(i)}>Review Item</Button>}
        </Card>
      ))}

      {reviewItem && <AdminReviewModal item={reviewItem} onClose={() => setReviewItem(null)} onAction={async (id, status, amount, comment) => {
        const col = reviewItem.type === 'expense' ? 'expenses' : 'requests';
        await updateDoc(doc(db, col, id), { status, amount, adminComment: comment, isEdited: amount !== reviewItem.originalAmount });
        setReviewItem(null);
      }} />}
    </div>
  );
}