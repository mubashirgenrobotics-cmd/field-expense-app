import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

// ─── GLOBAL STYLES (FONTS & DARK MODE) ────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --bg-page: #F8FAFC;
    --bg-card: #ffffff;
    --text-main: #111827;
    --text-muted: #6B7280;
    --text-light: #9CA3AF;
    --border: #E5E7EB;
    --input-bg: #F9FAFB;
    --hover-bg: #F3F4F6;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg-page: #0F172A;
      --bg-card: #1E293B;
      --text-main: #F9FAFB;
      --text-muted: #9CA3AF;
      --text-light: #64748B;
      --border: #334155;
      --input-bg: #0F172A;
      --hover-bg: #334155;
    }
  }

  * {
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif !important;
    letter-spacing: -0.01em;
  }
`;

// ─── INITIAL DATA ──────────────────────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: "admin", name: "Admin", role: "admin", password: "admin123", avatar: "A" },
  { id: "eng1", name: "Shubham", role: "engineer", password: "eng123", avatar: "AM", department: "South" },
  { id: "eng2", name: "Sunil", role: "engineer", password: "eng456", avatar: "PN", department: "North" },
  { id: "eng3", name: "Krishan", role: "engineer", password: "eng789", avatar: "RD", department: "north" },
];

const CATEGORIES = [
  { id: "travel", label: "Travel", icon: "✈️", color: "#3B82F6" },
  { id: "accommodation", label: "Accommodation", icon: "🏨", color: "#8B5CF6" },
  { id: "local_purchase", label: "Local Purchase", icon: "🛒", color: "#F59E0B" },
  { id: "other", label: "Other", icon: "📦", color: "#10B981" },
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
const monthOf = (d) => d?.slice(0, 7);
const initials = (name) => name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) : "?";

function inRange(date, f) {
  if (!date) return false;
  if (f.mode === "all") return true;
  if (f.mode === "month") return monthOf(date) === f.month;
  if (f.mode === "custom") return date >= f.from && date <= f.to;
  return true;
}

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

function downloadAttachment(exp) {
  if (!exp.attachment) return;
  const a = document.createElement("a");
  a.href = exp.attachment;
  const ext = exp.attachName ? exp.attachName.split(".").pop() : (exp.attachment.startsWith("data:image/png") ? "png" : exp.attachment.startsWith("data:application/pdf") ? "pdf" : "jpg");
  a.download = `bill-${exp.engineerName.replace(/\s+/g, "_")}-${exp.date}-${exp.id}.${ext}`;
  a.click();
}

async function generateExpenseReportPDF({ engineer, expenses, receivedFunds, requests, dateFrom, dateTo }) {
  const filtered = expenses.filter(e => {
    if (engineer && e.engineerId !== engineer.id) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  const filteredReqs = requests.filter(r => {
    if (engineer && r.engineerId !== engineer.id) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });

  const filteredFunds = receivedFunds.filter(f => {
    if (dateFrom && f.date < dateFrom) return false;
    if (dateTo && f.date > dateTo) return false;
    return true;
  });

  const dateRange = `${dateFrom || "All"} to ${dateTo || "All"}`;
  
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  document.head.appendChild(script);
  await new Promise(r => { script.onload = r; });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 16;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20); pdf.setFont("helvetica", "bold");
  pdf.text("FieldExpense Pro", M, 14);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
  pdf.text("Expense Report", M, 21);
  pdf.setFontSize(9);
  pdf.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}`, W - M, 21, { align: "right" });

  pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(15, 23, 42);
  pdf.text(`Engineer: ${engineer ? engineer.name : "All Engineers"}`, M, 50);
  pdf.setFontSize(10); pdf.setFont("helvetica", "normal"); pdf.setTextColor(107, 114, 128);
  pdf.text(`Department: ${engineer ? (engineer.department || "—") : "—"}`, M, 57);
  pdf.text(`Period: ${dateRange}`, M, 63);

  pdf.setDrawColor(229, 231, 235); pdf.setLineWidth(0.3);
  pdf.setFillColor(249, 250, 251);
  pdf.roundedRect(M, 70, W - M*2, 42, 3, 3, "FD");
  pdf.setFontSize(9); pdf.setTextColor(107, 114, 128); pdf.setFont("helvetica", "normal");

  let summaryItems = [];
  
  if (engineer) {
    // Engineer-specific calculation requested
    const totalApprovedAmount = filteredReqs.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
    const approvedExpenses = filtered.filter(e => e.status === "approved");
    const totalSubmittedApprovedBillAmount = approvedExpenses.reduce((s, e) => s + e.amount, 0); // All approved bills
    const balance = totalApprovedAmount - totalSubmittedApprovedBillAmount;

    summaryItems = [
      ["Total Approved Amount (Funds)", fmt(totalApprovedAmount), "#10B981"],
      ["Total Submitted Approved Bills", fmt(totalSubmittedApprovedBillAmount), "#EF4444"],
      ["Remaining Balance", fmt(balance), balance < 0 ? "#EF4444" : "#1E40AF"],
    ];
  } else {
    // Admin overall calculation
    const totalReceived = filteredFunds.reduce((s, f) => s + f.amount, 0);
    const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
    const approvedExpenses = filtered.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
    const balance = totalReceived - approvedExpenses;

    summaryItems = [
      ["Total Received (period)", fmt(totalReceived), "#065F46"],
      ["Total Submitted Expenses", fmt(totalExpenses), "#EF4444"],
      ["Approved Expenses", fmt(approvedExpenses), "#10B981"],
      ["Balance / Reimbursement", fmt(balance), balance < 0 ? "#EF4444" : "#1E40AF"],
    ];
  }

  summaryItems.forEach(([label, value, color], i) => {
    const x = M + (i % 2) * ((W - M*2) / 2) + 6;
    const y = 79 + Math.floor(i / 2) * 18;
    pdf.setTextColor(107, 114, 128); pdf.setFontSize(8);
    pdf.text(label, x, y);
    const [r2, g2, b2] = hexToRgb(color);
    pdf.setTextColor(r2, g2, b2); pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
    pdf.text(value, x, y + 7);
    pdf.setFont("helvetica", "normal");
  });

  let y = 120;
  pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(15, 23, 42);
  pdf.text("Expense Details", M, y); y += 6;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(M, y, W - M*2, 7, "F");
  pdf.setTextColor(255,255,255); pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
  const cols = [M+2, M+22, M+60, M+92, M+120, M+148];
  pdf.text("Date", cols[0], y+5);
  pdf.text("Description", cols[1], y+5);
  pdf.text("Category", cols[2], y+5);
  pdf.text("Customer", cols[3], y+5);
  pdf.text("Amount", cols[4], y+5);
  pdf.text("Status", cols[5], y+5);
  y += 8;

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
  filtered.forEach((exp, i) => {
    if (y > 270) { pdf.addPage(); y = 20; }
    if (i % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(M, y-1, W-M*2, 7, "F"); }
    pdf.setTextColor(15, 23, 42);
    pdf.text(exp.date || "", cols[0], y+4);
    pdf.text((exp.description || "").slice(0, 22), cols[1], y+4);
    pdf.text((CATEGORIES.find(c=>c.id===exp.category)?.label || "Other").slice(0,16), cols[2], y+4);
    pdf.text((exp.customer || "—").slice(0, 16), cols[3], y+4);
    pdf.text(fmt(exp.amount), cols[4], y+4);
    const sc = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending;
    const [sr, sg, sb] = hexToRgb(sc.color);
    pdf.setTextColor(sr, sg, sb);
    pdf.text(exp.status?.toUpperCase() || "", cols[5], y+4);
    pdf.setTextColor(15, 23, 42);
    y += 7;
  });

  const withAttach = filtered.filter(e => e.attachment);
  if (withAttach.length > 0) {
    pdf.addPage();
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, W, 18, "F");
    pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
    pdf.text("Bill Attachments", M, 12);

    for (let i = 0; i < withAttach.length; i++) {
      const exp = withAttach[i];
      if (!exp.attachment || !exp.attachment.startsWith("data:image")) continue;

      pdf.addPage();
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, W, 16, "F");
      pdf.setTextColor(255,255,255); pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
      pdf.text(`Bill ${i+1} of ${withAttach.length}`, M, 11);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
      pdf.text(`${exp.description} · ${exp.date} · ${fmt(exp.amount)}`, W - M, 11, { align: "right" });

      pdf.setFillColor(249, 250, 251);
      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(M, 20, W-M*2, 22, 2, 2, "FD");
      pdf.setTextColor(107, 114, 128); pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
      pdf.text(`Description: ${exp.description}`, M+4, 27);
      pdf.text(`Date: ${exp.date}    Amount: ${fmt(exp.amount)}    Status: ${exp.status?.toUpperCase()}`, M+4, 33);
      pdf.text(`Category: ${CATEGORIES.find(c=>c.id===exp.category)?.label || "Other"}    Customer: ${exp.customer || "—"}`, M+4, 39);

      try {
        const imgData = exp.attachment;
        const imgProps = pdf.getImageProperties(imgData);
        const maxW = W - M*2;
        const maxH = 210;
        let imgW = maxW, imgH = (imgProps.height / imgProps.width) * maxW;
        if (imgH > maxH) { imgH = maxH; imgW = (imgProps.width / imgProps.height) * maxH; }
        const imgX = M + (maxW - imgW) / 2;
        pdf.addImage(imgData, "JPEG", imgX, 46, imgW, imgH);
      } catch (e) {
        pdf.setTextColor(107,114,128); pdf.setFontSize(10);
        pdf.text("[Image could not be rendered]", W/2, 130, { align: "center" });
      }
    }
  }

  pdf.save(`expense-report-${engineer ? engineer.name.replace(/\s+/g,"_") : "all"}-${dateFrom||"all"}-to-${dateTo||"all"}.pdf`);
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : [0,0,0];
}

// ─── CHARTS & DASHBOARD EXTENSIONS ────────────────────────────────────────────
function SimplePieChart({ data, size = 160 }) {
  if (!data || data.length === 0 || data.every(d => d.value === 0)) {
    return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--hover-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-light)", fontSize: 12 }}>No Data</div>;
  }
  
  const total = data.reduce((s, d) => s + d.value, 0);
  let angle = 0;
  const gradient = data.map(d => {
    const start = angle;
    angle += (d.value / total) * 360;
    return `${d.color} ${start}deg ${angle}deg`;
  }).join(", ");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${gradient})`, boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
        {data.filter(d => d.value > 0).sort((a,b) => b.value - a.value).map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, background: "var(--input-bg)", padding: "6px 10px", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{d.label}</span>
            </div>
            <strong style={{ color: "var(--text-main)" }}>{fmt(d.value)}</strong>
          </div>
        ))}
        {/* ADDED TOTAL SECTION */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, background: "rgba(30, 64, 175, 0.1)", padding: "8px 10px", borderRadius: 8, marginTop: 4, border: "1px solid rgba(30, 64, 175, 0.2)" }}>
          <span style={{ color: "#1E40AF", fontWeight: 800 }}>Total</span>
          <strong style={{ color: "#1E40AF", fontWeight: 800 }}>{fmt(total)}</strong>
        </div>
      </div>
    </div>
  );
}

function LocationExpenseSummary({ expenses, customers, allMonths, isAdmin, engineers }) {
  const [filterMonth, setFilterMonth] = useState("all");
  const [selLoc, setSelLoc] = useState("all");
  const [selEng, setSelEng] = useState("all");

  // Filter based on month, approval status, and selected engineer (for admin)
  const filtered = expenses.filter(e => 
    (filterMonth === "all" || e.date.startsWith(filterMonth)) && 
    e.status === "approved" &&
    (selEng === "all" || e.engineerId === selEng)
  );
  
  const getLoc = (exp) => {
    const c = customers.find(c => c.name === exp.customer);
    return c?.location || "Unknown Location";
  };
  
  const expsWithLoc = filtered.map(e => ({ ...e, location: getLoc(e) }));
  const locations = [...new Set(expsWithLoc.map(e => e.location))];
  const chartColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#F43F5E", "#0EA5E9"];

  const locData = locations.map((loc, i) => ({
    label: loc,
    value: expsWithLoc.filter(e => e.location === loc).reduce((s, e) => s + e.amount, 0),
    color: chartColors[i % chartColors.length]
  }));

  const catExps = selLoc === "all" ? expsWithLoc : expsWithLoc.filter(e => e.location === selLoc);
  const catData = CATEGORIES.map(c => ({
    label: c.label,
    value: catExps.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0),
    color: c.color
  }));

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>📍 Approved Expenses Analysis</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isAdmin && engineers && (
            <select value={selEng} onChange={e => setSelEng(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--input-bg)", color: "var(--text-main)", fontSize: 14 }}>
              <option value="all">All Engineers</option>
              {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--input-bg)", color: "var(--text-main)", fontSize: 14 }}>
            <option value="all">All Months</option>
            {allMonths.map(m => <option key={m} value={m}>{new Date(m + "-01").toLocaleString("en-IN", { month: "short", year: "numeric" })}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 16, textAlign: "center" }}>Expense Share by Location</div>
          <SimplePieChart data={locData} />
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
             <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>Category Breakdown</div>
             <select value={selLoc} onChange={e => setSelLoc(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text-main)", fontSize: 12 }}>
               <option value="all">All Locations</option>
               {locations.map(l => <option key={l} value={l}>{l}</option>)}
             </select>
           </div>
          <SimplePieChart data={catData} />
        </div>
      </div>
    </Card>
  );
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Avatar({ user, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #1E40AF, #7C3AED)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700,
      fontSize: size * 0.35, flexShrink: 0,
    }}>{user.avatar || initials(user.name)}</div>
  );
}

function Badge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color,
      background: c.bg, letterSpacing: "0.04em", textTransform: "uppercase",
    }}>{c.label}</span>
  );
}

function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 24, color: "var(--text-main)", ...style }}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", disabled, style, small }) {
  const base = {
    border: "none", borderRadius: small ? 8 : 10, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, fontSize: small ? 12 : 14, padding: small ? "6px 14px" : "10px 22px",
    transition: "all 0.15s", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6, ...style,
  };
  const variants = {
    primary: { background: "linear-gradient(135deg,#1E40AF,#3B82F6)", color: "#fff" },
    success: { background: "linear-gradient(135deg,#065F46,#10B981)", color: "#fff" },
    danger: { background: "linear-gradient(135deg,#991B1B,#EF4444)", color: "#fff" },
    ghost: { background: "transparent", color: "var(--text-main)" },
    outline: { background: "transparent", color: "var(--text-main)", border: "1.5px solid var(--border)" },
    warning: { background: "linear-gradient(135deg,#92400E,#F59E0B)", color: "#fff" },
    teal: { background: "linear-gradient(135deg,#0F766E,#14B8A6)", color: "#fff" },
    purple: { background: "linear-gradient(135deg,#5B21B6,#8B5CF6)", color: "#fff" },
  };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
}

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 14, background: "var(--input-bg)", color: "var(--text-main)", boxSizing: "border-box" };

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>{children}</div>;
}

function CustomerDropdown({ value, onChange, customers }) {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(search.toLowerCase()))
  );

  const select = (c) => { onChange(c.name); setSearch(c.name); setOpen(false); };
  const clear = () => { onChange(""); setSearch(""); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search or type customer name..."
          style={{ ...inputStyle, flex: 1 }}
        />
        {search && <button onClick={clear} style={{ background: "none", border: "none", color: "var(--text-light)", cursor: "pointer", fontSize: 16, padding: "0 6px" }}>✕</button>}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: 10, zIndex: 500, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", marginTop: 4 }}>
          {filtered.map(c => (
            <div key={c.id} onClick={() => select(c)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--hover-bg)", display: "flex", justifyContent: "space-between", color: "var(--text-main)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--hover-bg)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
              {c.code && <span style={{ fontSize: 11, color: "var(--text-light)" }}>{c.code}</span>}
            </div>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1.5px solid var(--border)", borderRadius: 10, zIndex: 500, padding: "10px 14px", color: "var(--text-light)", fontSize: 13, marginTop: 4 }}>
          No match — "{search}" will be used as-is
        </div>
      )}
    </div>
  );
}

function DateRangeFilter({ filter, onChange, allMonths }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <select value={filter.mode} onChange={e => onChange({ mode: e.target.value, month: filter.month, from: filter.from, to: filter.to })} style={{ ...inputStyle, width: "auto", padding: "8px 14px", fontWeight: 600 }}>
        <option value="all">All Time</option>
        <option value="month">By Month</option>
        <option value="custom">Custom Range</option>
      </select>
      {filter.mode === "month" && (
        <select value={filter.month} onChange={e => onChange({ ...filter, month: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "8px 14px" }}>
          {allMonths.map(m => <option key={m} value={m}>{new Date(m + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}</option>)}
          {!allMonths.includes(filter.month) && filter.month && <option value={filter.month}>{new Date(filter.month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}</option>}
        </select>
      )}
      {filter.mode === "custom" && (
        <>
          <input type="date" value={filter.from} onChange={e => onChange({ ...filter, from: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }} />
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>to</span>
          <input type="date" value={filter.to} onChange={e => onChange({ ...filter, to: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }} />
        </>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, users }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const allUsers = users.length > 0 ? users : DEFAULT_USERS;
  
  const handle = () => {
    const u = allUsers.find(u => u.id === id && u.password === pw);
    if (u) onLogin(u); else setErr("Invalid credentials. Try again.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)" }}>
      <div style={{ textAlign: "center", width: "100%", maxWidth: 420, padding: "0 24px" }}>
        
        <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto 16px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: "linear-gradient(135deg, #1E40AF, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 40, fontWeight: 800 }}>FE</div>
          <img src="exp pro.png" alt="FieldExpense Pro Logo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 20, objectFit: "contain", background: "#fff", padding: 4 }} onError={(e) => e.target.style.display='none'} />
        </div>

        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>FieldExpense Pro</h1>
        <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 32px" }}>Field Engineer Expense Management</p>
        <Card>
          <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>User ID</label>
            <select value={id} onChange={e => setId(e.target.value)} style={inputStyle}>
              <option value="">Select user...</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}><label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="Enter password" style={inputStyle} />
          </div>
          {err && <p style={{ color: "#EF4444", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}
          <Button onClick={handle} style={{ width: "100%" }} disabled={!id || !pw}>Sign In →</Button>
        </Card>
      </div>
    </div>
  );
}

// ─── ADMIN DATABASE PANEL ─────────────────────────────────────────────────────
function AdminDatabase({ users, customers, onSaveUser, onDeleteUser, onSaveCustomer, onDeleteCustomer }) {
  const [activeTab, setActiveTab] = useState("engineers");
  const [showEngForm, setShowEngForm] = useState(false);
  const [editEng, setEditEng] = useState(null);
  const [showCustForm, setShowCustForm] = useState(false);
  const [editCust, setEditCust] = useState(null);
  const [custSearch, setCustSearch] = useState("");

  const engineers = users.filter(u => u.role === "engineer");
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(custSearch.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "var(--text-main)" }}>🗄️ Database Management</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Manage engineers, login credentials and customer list</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ id: "engineers", label: "👷 Engineers", count: engineers.length }, { id: "customers", label: "👥 Customers", count: customers.length }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
            background: activeTab === t.id ? "linear-gradient(135deg,#1E40AF,#3B82F6)" : "var(--hover-bg)",
            color: activeTab === t.id ? "#fff" : "var(--text-main)"
          }}>{t.label} <span style={{ opacity: 0.7, fontSize: 11 }}>({t.count})</span></button>
        ))}
      </div>

      {activeTab === "engineers" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button onClick={() => { setEditEng(null); setShowEngForm(true); }}>+ Add Engineer</Button>
          </div>
          <Card>
            {engineers.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-light)" }}>No engineers yet. Add one above.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {engineers.map(eng => (
                <div key={eng.id} style={{ padding: "14px 16px", background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar user={eng} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-main)" }}>{eng.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-light)" }}>{eng.department || "—"} · ID: {eng.id}</div>
                    <div style={{ fontSize: 12, color: "var(--text-light)" }}>Password: {"•".repeat(eng.password?.length || 6)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button small variant="outline" onClick={() => { setEditEng(eng); setShowEngForm(true); }}>✏️ Edit</Button>
                    <Button small variant="danger" onClick={() => onDeleteUser(eng.id)}>🗑️</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {activeTab === "customers" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="🔍 Search customers..." style={{ ...inputStyle, maxWidth: 300 }} />
            <Button onClick={() => { setEditCust(null); setShowCustForm(true); }}>+ Add Customer</Button>
          </div>
          <Card>
            {filteredCustomers.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-light)" }}>No customers found.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredCustomers.map(c => (
                <div key={c.id} style={{ padding: "12px 16px", background: "var(--input-bg)", borderRadius: 10, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7C3AED,#5B21B6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {c.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-light)" }}>{c.code ? `Code: ${c.code}` : ""}{c.location ? ` · ${c.location}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button small variant="outline" onClick={() => { setEditCust(c); setShowCustForm(true); }}>✏️ Edit</Button>
                    <Button small variant="danger" onClick={() => onDeleteCustomer(c.id)}>🗑️</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {showEngForm && <EngineerFormModal editItem={editEng} onSave={onSaveUser} onClose={() => { setShowEngForm(false); setEditEng(null); }} existingIds={users.map(u => u.id)} />}
      {showCustForm && <CustomerFormModal editItem={editCust} onSave={onSaveCustomer} onClose={() => { setShowCustForm(false); setEditCust(null); }} />}
    </div>
  );
}

// ─── MODALS & FORMS ──────────────────────────────────────────────────────────
function EngineerFormModal({ editItem, onSave, onClose, existingIds }) {
  const [name, setName] = useState(editItem?.name || "");
  const [department, setDepartment] = useState(editItem?.department || "");
  const [password, setPassword] = useState(editItem?.password || "");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    if (!name.trim() || !password.trim()) { setErr("Name and password are required."); return; }
    const id = editItem?.id || "eng_" + uid();
    onSave({
      id, name: name.trim(), department: department.trim(),
      password: password.trim(), role: "engineer",
      avatar: initials(name.trim()),
    });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👷 {editItem ? "Edit Engineer" : "Add Engineer"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
        </div>
        <Field label="Full Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arjun Menon" style={inputStyle} /></Field>
        <Field label="Department / Region"><input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. South Kerala" style={inputStyle} /></Field>
        <Field label="Password">
          <div style={{ display: "flex", gap: 6 }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Set login password" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => setShowPw(!showPw)} style={{ background: "var(--hover-bg)", border: "none", borderRadius: 8, padding: "0 10px", cursor: "pointer", fontSize: 16 }}>{showPw ? "🙈" : "👁️"}</button>
          </div>
        </Field>
        {editItem && <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#92400E", marginBottom: 12 }}>⚠️ Engineer ID cannot be changed: <strong>{editItem.id}</strong></div>}
        {err && <p style={{ color: "#EF4444", fontSize: 13, margin: "0 0 12px" }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={submit} disabled={!name || !password} style={{ flex: 1 }}>{editItem ? "Update" : "Add Engineer"}</Button>
        </div>
      </Card>
    </div>
  );
}

function CustomerFormModal({ editItem, onSave, onClose }) {
  const [name, setName] = useState(editItem?.name || "");
  const [code, setCode] = useState(editItem?.code || "");
  const [location, setLocation] = useState(editItem?.location || "");
  const [contact, setContact] = useState(editItem?.contact || "");

  const submit = () => {
    if (!name.trim()) return;
    onSave({ id: editItem?.id || "cust_" + uid(), name: name.trim(), code: code.trim(), location: location.trim(), contact: contact.trim() });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👥 {editItem ? "Edit Customer" : "Add Customer"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
        </div>
        <Field label="Customer Name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BSNL Kochi" style={inputStyle} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Customer Code"><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. BSN-001" style={inputStyle} /></Field>
          <Field label="Location"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Ernakulam" style={inputStyle} /></Field>
        </div>
        <Field label="Contact / Notes"><input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact person or notes" style={inputStyle} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={submit} disabled={!name} style={{ flex: 1 }}>{editItem ? "Update" : "Add Customer"}</Button>
        </div>
      </Card>
    </div>
  );
}

function ExpenseReportModal({ engineers, expenses, receivedFunds, requests, onClose }) {
  const [selEng, setSelEng] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const engineer = engineers.find(e => e.id === selEng) || null;
  const filtered = expenses.filter(e => {
    if (selEng && e.engineerId !== selEng) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });
  
  const filteredReqs = requests.filter(r => {
    if (selEng && r.engineerId !== selEng) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });

  const filteredFunds = receivedFunds.filter(f => {
    if (dateFrom && f.date < dateFrom) return false;
    if (dateTo && f.date > dateTo) return false;
    return true;
  });

  const totalReceived = filteredFunds.reduce((s, f) => s + f.amount, 0);
  const totalExp = filtered.reduce((s, e) => s + e.amount, 0);
  const approvedExp = filtered.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalApprovedFunds = filteredReqs.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);

  const download = async () => {
    setLoading(true);
    try { await generateExpenseReportPDF({ engineer, expenses, receivedFunds, requests, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }); } 
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📥 Download Expense Report</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
        </div>
        <Field label="Select Engineer">
          <select value={selEng} onChange={e => setSelEng(e.target.value)} style={inputStyle}>
            <option value="">All Engineers (Overall Report)</option>
            {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Date From"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} /></Field>
          <Field label="Date To"><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} /></Field>
        </div>

        <div style={{ background: "var(--input-bg)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>Report Preview</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Target", engineer?.name || "All Engineers"],
              ["Expenses in range", filtered.length + " entries"],
              engineer ? ["Total Approved Funds", fmt(totalApprovedFunds)] : ["Total Received Funds", fmt(totalReceived)],
              engineer ? ["Approved Submitted Bills", fmt(approvedExp)] : ["Total Submitted Expenses", fmt(totalExp)],
              engineer ? ["Remaining Balance", fmt(totalApprovedFunds - approvedExp)] : ["Overall Balance", fmt(totalReceived - approvedExp)],
            ].map(([k, v]) => (
              <div key={k} style={{ fontSize: 12 }}><span style={{ color: "var(--text-light)" }}>{k}: </span><span style={{ fontWeight: 600, color: "var(--text-main)" }}>{v}</span></div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={download} disabled={loading} variant="success" style={{ flex: 1 }}>{loading ? "⏳ Generating..." : "📥 Download PDF"}</Button>
        </div>
      </Card>
    </div>
  );
}

function ReceivedFundModal({ onSave, onClose, editItem }) {
  const [amount, setAmount] = useState(editItem?.amount || "");
  const [date, setDate] = useState(editItem?.date || today());
  const [purpose, setPurpose] = useState(editItem?.purpose || "");
  const [pfrNo, setPfrNo] = useState(editItem?.pfrNo || "");
  const [source, setSource] = useState(editItem?.source || "");
  const [remarks, setRemarks] = useState(editItem?.remarks || "");

  const submit = () => {
    if (!amount || !date || !purpose) return;
    onSave({ id: editItem?.id || uid(), amount: parseFloat(amount), date, purpose, pfrNo, source, remarks, createdAt: editItem?.createdAt || today() });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16, overflowY: "auto" }}>
      <Card style={{ width: "100%", maxWidth: 480, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💵 {editItem ? "Edit" : "Add"} Received Fund</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Amount Received (₹)"><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
          <Field label="Received Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Purpose"><input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose of this fund" style={inputStyle} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="PFR No."><input value={pfrNo} onChange={e => setPfrNo(e.target.value)} placeholder="PFR number" style={inputStyle} /></Field>
          <Field label="Source / From"><input value={source} onChange={e => setSource(e.target.value)} placeholder="Fund source" style={inputStyle} /></Field>
        </div>
        <Field label="Remarks (optional)"><textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any additional notes..." rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={submit} disabled={!amount || !date || !purpose} style={{ flex: 1 }}>{editItem ? "Update" : "Add Fund"}</Button>
        </div>
      </Card>
    </div>
  );
}

function AdminReviewModal({ item, type, onClose, onApprove, onReject }) {
  const [amount, setAmount] = useState(item.amount);
  const [comment, setComment] = useState("");
  const amountChanged = parseFloat(amount) !== item.amount;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Review {type === "request" ? "Fund Request" : "Expense"}</h3>
        <div style={{ background: "var(--input-bg)", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, color: "var(--text-main)" }}>
          <strong>Engineer:</strong> {item.engineerName}<br />
          <strong>Reason:</strong> {item.reason || item.description}<br />
          {item.customer && <><strong>Customer:</strong> {item.customer}<br /></>}
          <strong>Date:</strong> {item.date}<br />
          <strong>Original Amount:</strong> <span style={{ color: "#3B82F6", fontWeight: 700 }}>{fmt(item.amount)}</span>
        </div>
        <Field label="Approved Amount (₹)"><input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} /></Field>
        {amountChanged && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
            <span style={{ color: "#92400E", fontWeight: 600 }}>⚠️ Amount edited:</span> <span style={{ color: "#78350F" }}>{fmt(item.amount)} → {fmt(parseFloat(amount) || 0)}</span>
          </div>
        )}
        <Field label={`Admin Comment ${amountChanged ? "(required)" : "(optional)"}`}>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a note or reason..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={() => { onReject(item.id, comment); onClose(); }} variant="danger" style={{ flex: 1 }}>Reject</Button>
          <Button onClick={() => { onApprove(item.id, parseFloat(amount), comment, item.amount); onClose(); }} variant="success" disabled={amountChanged && !comment.trim()} style={{ flex: 1 }}>Approve</Button>
        </div>
      </Card>
    </div>
  );
}

function FundRequestForm({ user, onSubmit, onClose, customers }) {
  const [breakdown, setBreakdown] = useState({});
  const [reason, setReason] = useState("");
  const [customer, setCustomer] = useState("");

  const handleAmountChange = (catId, val) => {
    setBreakdown(prev => ({ ...prev, [catId]: parseFloat(val) || 0 }));
  };

  const totalAmount = CATEGORIES.reduce((sum, cat) => sum + (breakdown[cat.id] || 0), 0);

  const submit = () => {
    if (totalAmount <= 0 || !reason) return;
    const breakdownText = CATEGORIES.map(c => breakdown[c.id] ? `${c.label}: ${fmt(breakdown[c.id])}` : null).filter(Boolean).join(", ");

    onSubmit({ 
      id: uid(), engineerId: user.id, engineerName: user.name, 
      amount: totalAmount, reason: `${reason} (${breakdownText})`, 
      breakdown, category: "multiple", customer, 
      status: "pending", date: today(), createdAt: Date.now(), type: "fund_request" 
    });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💰 Request Funds</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
        </div>
        
        <Field label="Customer (optional)">
          <CustomerDropdown value={customer} onChange={setCustomer} customers={customers} />
        </Field>
        
        <div style={{ background: "var(--input-bg)", padding: 16, borderRadius: 12, marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>Expense Breakdown</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {CATEGORIES.map(c => (
              <div key={c.id}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 4, color: "var(--text-main)" }}>{c.icon} {c.label}</label>
                <input type="number" placeholder="0.00" value={breakdown[c.id] || ""} onChange={e => handleAmountChange(c.id, e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Total Amount:</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#3B82F6" }}>{fmt(totalAmount)}</span>
          </div>
        </div>

        <Field label="Reason / Trip Details">
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the purpose of this request..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={submit} disabled={totalAmount <= 0 || !reason} style={{ flex: 1 }}>Submit Request</Button>
        </div>
      </Card>
    </div>
  );
}

function ExpenseForm({ user, availableBalance, onSubmit, onClose, editItem, customers }) {
  const [amount, setAmount] = useState(editItem?.amount || "");
  const [category, setCategory] = useState(editItem?.category || "travel");
  const [description, setDescription] = useState(editItem?.description || "");
  const [date, setDate] = useState(editItem?.date || today());
  const [attachment, setAttachment] = useState(editItem?.attachment || null);
  const [attachName, setAttachName] = useState(editItem?.attachName || "");
  const [customer, setCustomer] = useState(editItem?.customer || "");
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
      customer, type: "expense", status: "pending", createdAt: editItem?.createdAt || Date.now(), editLog: editItem?.editLog || [],
    });
    onClose();
  };

  const over = parseFloat(amount) > availableBalance;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}>
      <Card style={{ width: "100%", maxWidth: 500, margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editItem ? "✏️ Edit Expense" : "🧾 Add Expense"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
        </div>
        <div style={{ background: "rgba(59, 130, 246, 0.1)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, border: "1px solid rgba(59, 130, 246, 0.2)" }}>
          Available Balance: <strong style={{ color: "#3B82F6" }}>{fmt(availableBalance)}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Customer (optional)">
          <CustomerDropdown value={customer} onChange={setCustomer} customers={customers} />
        </Field>
        <Field label="Amount (₹)">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, borderColor: over ? "#EF4444" : undefined }} />
          {over && <span style={{ color: "#EF4444", fontSize: 12 }}>⚠ Exceeds available balance</span>}
        </Field>
        <Field label="Description"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this expense for?" style={inputStyle} /></Field>
        <Field label="Attachment (Camera/Bill)">
          <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${attachment ? "#10B981" : "var(--border)"}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer", background: attachment ? "rgba(16, 185, 129, 0.05)" : "var(--input-bg)" }}>
            {attachment ? <><span style={{ fontSize: 22 }}>✅</span><br /><span style={{ fontSize: 13, color: "#10B981", fontWeight: 600 }}>{attachName}</span></> : <><span style={{ fontSize: 22 }}>📷</span><br /><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Tap to take photo or upload bill</span></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        </Field>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={submit} disabled={!amount || !description || !attachment || over} style={{ flex: 1 }}>{editItem ? "Update Expense" : "Submit Expense"}</Button>
        </div>
      </Card>
    </div>
  );
}

function ConfirmDeleteModal({ item, itemType, onConfirm, onClose }) {
  const label = itemType === "request" ? `fund request of ${fmt(item.amount)}` : itemType === "received" ? `received fund of ${fmt(item.amount)}` : `expense "${item.description}" (${fmt(item.amount)})`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 360 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700 }}>🗑️ Delete</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px" }}>Are you sure you want to delete the {label} by <strong>{item.engineerName || "Admin"}</strong>? This cannot be undone.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={onClose} variant="ghost" style={{ flex: 1, border: "1px solid var(--border)" }}>Cancel</Button>
          <Button onClick={() => { onConfirm(item.id); onClose(); }} variant="danger" style={{ flex: 1 }}>Delete</Button>
        </div>
      </Card>
    </div>
  );
}

function ExpenseList({ expenses, onEdit, onViewAttachment, onReview, onDelete, isAdmin, filter, isReadOnly }) {
  const cat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[3];
  
  // Enforce latest first sort by date then createdAt
  const filtered = expenses
    .filter(e => {
      if (!inRange(e.date, filter.dateRange || { mode: "all" })) return false;
      if (filter.status !== "all" && e.status !== filter.status) return false;
      if (isAdmin && filter.engineer && e.engineerId !== filter.engineer) return false;
      return true;
    })
    .sort((a, b) => {
      const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
      return dateDiff !== 0 ? dateDiff : (b.createdAt || 0) - (a.createdAt || 0);
    });

  if (!filtered.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-light)", fontSize: 14 }}>No expenses found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(exp => {
        const c = cat(exp.category);
        const hasEditLog = exp.editLog && exp.editLog.length > 0;
        return (
          <div key={exp.id} style={{ padding: "14px 16px", background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-main)" }}>{exp.description}</span>
                  <Badge status={exp.status} />
                  {hasEditLog && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>EDITED</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-light)" }}>
                  {c.label} · {exp.date}
                  {exp.customer && <> · <span style={{ color: "#7C3AED", fontWeight: 600 }}>👥 {exp.customer}</span></>}
                  {isAdmin && <> · <span style={{ color: "var(--text-muted)" }}>{exp.engineerName}</span></>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#EF4444" }}>-{fmt(exp.amount)}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4, flexWrap: "wrap" }}>
                  {exp.attachment && <Button small variant="outline" onClick={() => onViewAttachment(exp)}>📎 Bill</Button>}
                  {isAdmin && exp.attachment && <Button small variant="ghost" onClick={() => downloadAttachment(exp)}>⬇️</Button>}
                  
                  {/* Hide write actions if in Read Only Mode */}
                  {!isReadOnly && !isAdmin && exp.status === "pending" && <Button small variant="outline" onClick={() => onEdit(exp)}>Edit</Button>}
                  {!isReadOnly && isAdmin && exp.status === "pending" && <Button small variant="primary" onClick={() => onReview(exp)}>Review</Button>}
                  {!isReadOnly && isAdmin && <Button small variant="danger" onClick={() => onDelete(exp)}>🗑️</Button>}
                </div>
              </div>
            </div>
            {hasEditLog && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
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

function RequestList({ requests, isAdmin, engineerId, filter, onReview, onDelete, isReadOnly }) {
  // Enforce latest first sort by date then createdAt
  const filtered = requests
    .filter(r => {
      if (!isAdmin && r.engineerId !== engineerId) return false;
      if (!inRange(r.date, filter.dateRange || { mode: "all" })) return false;
      if (filter.status !== "all" && r.status !== filter.status) return false;
      if (isAdmin && filter.engineer && r.engineerId !== filter.engineer) return false;
      return true;
    })
    .sort((a, b) => {
      const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
      return dateDiff !== 0 ? dateDiff : (b.createdAt || 0) - (a.createdAt || 0);
    });

  if (!filtered.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-light)", fontSize: 14 }}>No requests found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(req => {
        const c = CATEGORIES.find(c => c.id === req.category) || CATEGORIES[3];
        const hasEditLog = req.editLog && req.editLog.length > 0;
        
        const originalAmt = hasEditLog && req.editLog[0].before !== undefined ? req.editLog[0].before : req.amount;
        const isEditedAmt = parseFloat(originalAmt) !== parseFloat(req.amount);

        return (
          <div key={req.id} style={{ padding: "14px 16px", background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{req.category === "multiple" ? "💸" : c.icon}</div>
              <div style={{ flex: 1 }}>
                
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  {isEditedAmt ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(16, 185, 129, 0.1)", padding: "4px 8px", borderRadius: 6, border: "1px dashed #34D399" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "line-through" }}>Requested: {fmt(originalAmt)}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#10B981" }}>Approved: {fmt(req.amount)}</span>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#3B82F6" }}>{fmt(req.amount)}</span>
                  )}
                  <Badge status={req.status} />
                  {hasEditLog && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>EDITED</span>}
                </div>
                
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{req.reason}</div>
                {req.customer && <div style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, marginTop: 2 }}>👥 {req.customer}</div>}
                {isAdmin && <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 2 }}>By: {req.engineerName} · {req.date}</div>}
              </div>
              <div style={{ flexShrink: 0, display: "flex", gap: 6 }}>
                {!isReadOnly && isAdmin && req.status === "pending" && <Button small variant="primary" onClick={() => onReview(req)}>Review</Button>}
                {!isReadOnly && isAdmin && <Button small variant="danger" onClick={() => onDelete(req)}>🗑️</Button>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReceivedFundList({ funds, onEdit, onDelete, filter, isReadOnly }) {
  // Enforce latest first sort by date then createdAt
  const filtered = funds
    .filter(f => inRange(f.date, filter.dateRange || { mode: "all" }))
    .sort((a, b) => {
      const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
      return dateDiff !== 0 ? dateDiff : (b.createdAt || 0) - (a.createdAt || 0);
    });

  if (!filtered.length) return <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-light)", fontSize: 14 }}>No received funds found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(f => (
        <div key={f.id} style={{ padding: "14px 16px", background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>💵</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#10B981" }}>{fmt(f.amount)}</span>
              {f.pfrNo && <span style={{ fontSize: 11, background: "rgba(59, 130, 246, 0.1)", color: "#3B82F6", padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>PFR: {f.pfrNo}</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 600 }}>{f.purpose}</div>
            <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 2 }}>
              {f.date}{f.source ? ` · From: ${f.source}` : ""}
              {f.remarks ? <span style={{ marginLeft: 8, color: "var(--text-muted)", fontStyle: "italic" }}>{f.remarks}</span> : null}
            </div>
          </div>
          {!isReadOnly && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <Button small variant="outline" onClick={() => onEdit(f)}>✏️ Edit</Button>
              <Button small variant="danger" onClick={() => onDelete(f)}>🗑️</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminSummary({ expenses, requests, receivedFunds, dashFilter, engineers, onViewEngineer }) {
  const mReqs = requests.filter(r => inRange(r.date, dashFilter));
  const mExps = expenses.filter(e => inRange(e.date, dashFilter));
  const mFunds = receivedFunds.filter(f => inRange(f.date, dashFilter));

  const totalReceived = mFunds.reduce((s, f) => s + f.amount, 0);
  const totalDisbursed = mReqs.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const totalSubmittedBills = mExps.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const unsubmitted = totalDisbursed - totalSubmittedBills;
  const remainingReceived = totalReceived - totalDisbursed;

  return (
    <>
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg,#0F172A,#1E1B4B)", border: "none", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: totalReceived > 0 ? 16 : 0 }}>
          {[
            { label: "Received Fund", value: fmt(totalReceived), color: "#34D399" },
            { label: "Distributed", value: fmt(totalDisbursed), color: "#F59E0B" },
            { label: "Total Submitted Bills", value: fmt(totalSubmittedBills), color: "#EF4444", sub: "approved bills sum" },
            { label: "Pending Bills", value: fmt(Math.max(0, unsubmitted)), color: unsubmitted < 0 ? "#EF4444" : "#FBBF24", sub: "distributed − submitted" },
            { label: "Fund Balance", value: fmt(remainingReceived), color: remainingReceived < 0 ? "#EF4444" : "#60A5FA", sub: "received − distributed" },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
              {item.sub && <div style={{ fontSize: 10, color: "#64748B" }}>{item.sub}</div>}
            </div>
          ))}
        </div>
        {totalReceived > 0 && (
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (totalDisbursed / totalReceived) * 100)}%`, background: "linear-gradient(90deg,#3B82F6,#7C3AED)", borderRadius: 8, transition: "width 0.5s" }} />
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        {engineers.map(eng => {
          const engReqs = mReqs.filter(r => r.engineerId === eng.id);
          const engExps = mExps.filter(e => e.engineerId === eng.id);
          const funds = engReqs.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
          const approvedBills = engExps.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
          const pendingBills = engExps.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);
          const bal = funds - approvedBills;
          return (
            <Card key={eng.id} style={{ padding: 16, cursor: "pointer", transition: "transform 0.15s" }} onClick={() => onViewEngineer(eng)} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <Avatar user={eng} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{eng.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-light)" }}>{eng.department}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Funds Distributed</span><span style={{ color: "#10B981", fontWeight: 700 }}>{fmt(funds)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Submitted Bills</span><span style={{ color: "#EF4444", fontWeight: 700 }}>{fmt(approvedBills)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Pending Bills</span><span style={{ color: "#F59E0B", fontWeight: 700 }}>{fmt(pendingBills)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid var(--border)" }}><span style={{ color: "var(--text-main)", fontWeight: 600 }}>Balance</span><span style={{ color: bal < 0 ? "#EF4444" : "#3B82F6", fontWeight: 700 }}>{fmt(bal)}</span></div>
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
  const [user, setUser] = useState(() => { const s = localStorage.getItem("activeUser"); return s ? JSON.parse(s) : null; });
  const [viewingAsEngineer, setViewingAsEngineer] = useState(null); // Admin read-only toggle
  const isReadOnly = viewingAsEngineer !== null;
  const activeUser = viewingAsEngineer || user;
  const isAdmin = user?.role === "admin" && !viewingAsEngineer;

  const handleLogin = (u) => { localStorage.setItem("activeUser", JSON.stringify(u)); setUser(u); setViewingAsEngineer(null); };
  const handleLogout = () => { localStorage.removeItem("activeUser"); setUser(null); setViewingAsEngineer(null); };

  const [expenses, setExpenses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [receivedFunds, setReceivedFunds] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [tab, setTab] = useState("dashboard");
  const [showFundForm, setShowFundForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReceivedFundModal, setShowReceivedFundModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editReceivedFund, setEditReceivedFund] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [viewAttachment, setViewAttachment] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteItemType, setDeleteItemType] = useState("expense");

  const [dashFilter, setDashFilter] = useState({ mode: "all", month: monthOf(today()), from: today(), to: today() });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEngineer, setFilterEngineer] = useState("");
  const [tabDateFilter, setTabDateFilter] = useState({ mode: "all", month: monthOf(today()), from: today(), to: today() });
  const [rfDateFilter, setRfDateFilter] = useState({ mode: "all", month: monthOf(today()), from: today(), to: today() });

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "expenses"), snap => setExpenses(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "requests"), snap => setRequests(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "receivedFunds"), snap => setReceivedFunds(snap.docs.map(d => d.data()))),
      onSnapshot(collection(db, "users"), snap => {
        const u = snap.docs.map(d => d.data());
        setDbUsers(u.length > 0 ? u : DEFAULT_USERS);
      }),
      onSnapshot(collection(db, "customers"), snap => setCustomers(snap.docs.map(d => d.data()))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (dbUsers.length === 0) {
      DEFAULT_USERS.forEach(u => setDoc(doc(db, "users", u.id), u));
    }
  }, [dbUsers]);

  const allUsers = dbUsers.length > 0 ? dbUsers : DEFAULT_USERS;
  const engineers = allUsers.filter(u => u.role === "engineer");

  if (!user) return <><style>{GLOBAL_CSS}</style><Login onLogin={handleLogin} users={allUsers} /></>;

  const myRequests = requests.filter(r => r.engineerId === activeUser.id);
  const myExpenses = expenses.filter(e => e.engineerId === activeUser.id);
  const approvedFunds = myRequests.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const approvedExpenses = myExpenses.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const availableBalance = approvedFunds - approvedExpenses;

  const allMonths = Array.from(new Set([
    ...expenses.map(e => monthOf(e.date)),
    ...requests.map(r => monthOf(r.date)),
    ...receivedFunds.map(f => monthOf(f.date)),
  ])).filter(Boolean).sort((a, b) => b.localeCompare(a));

  const addRequest = async (req) => await setDoc(doc(db, "requests", req.id), req);
  const addExpense = async (exp) => await setDoc(doc(db, "expenses", exp.id), exp);
  const saveReceivedFund = async (fund) => await setDoc(doc(db, "receivedFunds", fund.id), fund);
  const deleteReceivedFund = async (id) => await deleteDoc(doc(db, "receivedFunds", id));
  const saveUser = async (u) => await setDoc(doc(db, "users", u.id), u);
  const deleteUser = async (id) => await deleteDoc(doc(db, "users", id));
  const saveCustomer = async (c) => await setDoc(doc(db, "customers", c.id), c);
  const deleteCustomer = async (id) => await deleteDoc(doc(db, "customers", id));

  const approveItem = async (col, id, finalAmount, comment, originalAmount) => {
    const updates = { status: "approved", amount: finalAmount };
    const existing = col === "expenses" ? expenses.find(e => e.id === id) : requests.find(r => r.id === id);
    if (finalAmount !== originalAmount || comment) {
      const log = [...(existing?.editLog || [])];
      log.push({ date: today(), before: originalAmount, after: finalAmount, comment: comment || "" });
      updates.editLog = log;
    }
    await updateDoc(doc(db, col, id), updates);
  };

  const rejectItem = async (col, id, comment) => {
    const existing = col === "expenses" ? expenses.find(e => e.id === id) : requests.find(r => r.id === id);
    const updates = { status: "rejected" };
    if (comment) {
      const log = [...(existing?.editLog || [])];
      log.push({ date: today(), before: existing?.amount, after: existing?.amount, comment: `REJECTED: ${comment}` });
      updates.editLog = log;
    }
    await updateDoc(doc(db, col, id), updates);
  };

  const deleteExpense = async (id) => await deleteDoc(doc(db, "expenses", id));
  const deleteRequest = async (id) => await deleteDoc(doc(db, "requests", id));

  const pendingReqCount = requests.filter(r => r.status === "pending").length;
  const pendingExpCount = expenses.filter(e => e.status === "pending").length;

  const adminTabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "received", label: "Received Funds", icon: "💵" },
    { id: "requests", label: `Requests${pendingReqCount ? ` (${pendingReqCount})` : ""}`, icon: "📋" },
    { id: "expenses", label: `Expenses${pendingExpCount ? ` (${pendingExpCount})` : ""}`, icon: "🧾" },
    { id: "database", label: "Database", icon: "🗄️" },
  ];
  const engTabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "requests", label: "Fund Requests", icon: "💰" },
    { id: "expenses", label: "My Expenses", icon: "🧾" },
  ];
  const tabs = (user.role === "admin" && !viewingAsEngineer) ? adminTabs : engTabs;

  const tabFilterUI = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      {isAdmin && <select value={filterEngineer} onChange={e => setFilterEngineer(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}>
        <option value="">All Engineers</option>
        {engineers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>}
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 12px" }}>
        <option value="all">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <DateRangeFilter filter={tabDateFilter} onChange={setTabDateFilter} allMonths={allMonths} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", color: "var(--text-main)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* NAV */}
      <div style={{ background: "#0F172A", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, overflowX: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, height: 58, minWidth: 600 }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ position: "relative", height: 36, width: 36, flexShrink: 0 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "linear-gradient(135deg, #1E40AF, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 800 }}>FE</div>
              <img src="exp pro.png" alt="Logo" style={{ position: "absolute", inset: 0, height: "100%", width: "100%", borderRadius: 8, objectFit: "contain", background: "#fff", padding: 2 }} onError={(e) => e.target.style.display='none'} />
            </div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>FieldExpense</span>
          </div>

          <div style={{ display: "flex", gap: 2, flex: 1 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setFilterStatus("all"); setFilterEngineer(""); setTabDateFilter({ mode: "all", month: monthOf(today()), from: today(), to: today() }); }}
                style={{ background: tab === t.id ? "rgba(59,130,246,0.2)" : "none", border: "none", borderRadius: 8, padding: "6px 12px", color: tab === t.id ? "#60A5FA" : "#94A3B8", cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, whiteSpace: "nowrap" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Avatar user={user} size={32} />
            <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, color: "#94A3B8", padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* Read Only Admin Warning Banner */}
        {isReadOnly && (
          <div style={{ background: "#FEF2F2", border: "1px solid #F87171", color: "#991B1B", padding: "12px 20px", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14 }}>⚠️ Viewing as <strong>{activeUser.name}</strong> (Read-Only Mode)</span>
            <Button small variant="danger" onClick={() => { setViewingAsEngineer(null); setTab("dashboard"); }}>Exit View</Button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <>
            {isAdmin ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Admin Dashboard</h2>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Filter Period</div>
                      <DateRangeFilter filter={dashFilter} onChange={setDashFilter} allMonths={allMonths} />
                    </div>
                    <Button variant="success" onClick={() => setShowReportModal(true)}>📥 Expense Report</Button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
                  {(() => {
                    const mR = requests.filter(r => inRange(r.date, dashFilter));
                    const mE = expenses.filter(e => inRange(e.date, dashFilter));
                    const mF = receivedFunds.filter(f => inRange(f.date, dashFilter));
                    return [
                      { label: "Received Fund", value: fmt(mF.reduce((s, f) => s + f.amount, 0)), icon: "💵", color: "#10B981" },
                      { label: "Pending Fund Requests", value: mR.filter(r => r.status === "pending").length, icon: "⏳", color: "#F59E0B" },
                      { label: "Pending Expenses", value: mE.filter(e => e.status === "pending").length, icon: "📋", color: "#EF4444" },
                      { label: "Total Distributed", value: fmt(mR.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0)), icon: "💰", color: "#3B82F6" },
                    ];
                  })().map(s => (
                    <Card key={s.label} style={{ padding: "18px 20px" }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
                    </Card>
                  ))}
                </div>

                {/* Passed isAdmin and engineers so the component renders the dropdown */}
                <LocationExpenseSummary expenses={expenses} customers={customers} allMonths={allMonths} isAdmin={isAdmin} engineers={engineers} />
                <AdminSummary expenses={expenses} requests={requests} receivedFunds={receivedFunds} dashFilter={dashFilter} engineers={engineers} onViewEngineer={setViewingAsEngineer} />
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                  <div>
                    <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>{isReadOnly ? `Profile: ${activeUser.name}` : `Welcome, ${activeUser.name} 👋`}</h2>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>{activeUser.department}</p>
                  </div>
                  {!isReadOnly && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <Button onClick={() => setShowFundForm(true)} variant="outline">💰 Request Funds</Button>
                      <Button onClick={() => { setEditExpense(null); setShowExpenseForm(true); }} disabled={availableBalance <= 0}>🧾 Add Expense</Button>
                    </div>
                  )}
                </div>
                
                <Card style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>📒 My Ledger</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Approved Funds", value: fmt(approvedFunds), color: "#10B981", icon: "💰" },
                      { label: "Approved Expenses", value: fmt(approvedExpenses), color: "#EF4444", icon: "🧾" },
                      { label: "Available Balance", value: fmt(availableBalance), color: availableBalance < 0 ? "#EF4444" : "#3B82F6", icon: "📊" },
                    ].map(item => (
                      <div key={item.label} style={{ background: "var(--input-bg)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                
                {/* MOVED: Pie chart is now strictly below My Ledger per request */}
                <LocationExpenseSummary expenses={myExpenses} customers={customers} allMonths={allMonths} isAdmin={false} />

                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Recent Expenses</h3><Button small variant="ghost" onClick={() => setTab("expenses")}>View all →</Button></div>
                  
                  {/* Latest first slice is done AFTER sort inside ExpenseList component. Using dummy large max count filter to cap it. */}
                  <ExpenseList 
                    expenses={myExpenses.sort((a,b) => new Date(b.date||0) - new Date(a.date||0)).slice(0, 5)} 
                    onEdit={e => { setEditExpense(e); setShowExpenseForm(true); }} 
                    onViewAttachment={setViewAttachment} 
                    onDelete={exp => { setDeleteItem(exp); setDeleteItemType("expense"); }} 
                    filter={{ dateRange: { mode: "all" }, status: "all" }} 
                    isReadOnly={isReadOnly}
                  />
                </Card>
              </>
            )}
          </>
        )}

        {/* ── RECEIVED FUNDS (admin only) ── */}
        {tab === "received" && isAdmin && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800 }}>💵 Received Funds</h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Record incoming funds with date, purpose and PFR details</p>
              </div>
              <Button variant="teal" onClick={() => { setEditReceivedFund(null); setShowReceivedFundModal(true); }}>+ Add Received Fund</Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
              {(() => {
                const filtered = receivedFunds.filter(f => inRange(f.date, rfDateFilter));
                const total = filtered.reduce((s, f) => s + f.amount, 0);
                const entries = filtered.length;
                const latest = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                return [
                  { label: "Total Received", value: fmt(total), icon: "💵", color: "#10B981" },
                  { label: "Entries", value: entries, icon: "📋", color: "#3B82F6" },
                  { label: "Latest Entry", value: latest ? latest.date : "—", icon: "📅", color: "#8B5CF6" },
                ];
              })().map(s => (
                <Card key={s.label} style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 2 }}>{s.label}</div>
                </Card>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <DateRangeFilter filter={rfDateFilter} onChange={setRfDateFilter} allMonths={allMonths} />
            </div>
            <Card>
              <ReceivedFundList funds={receivedFunds} filter={{ dateRange: rfDateFilter }}
                onEdit={f => { setEditReceivedFund(f); setShowReceivedFundModal(true); }}
                onDelete={f => { setDeleteItem(f); setDeleteItemType("received"); }}
                isReadOnly={isReadOnly} />
            </Card>
          </>
        )}

        {/* ── FUND REQUESTS ── */}
        {tab === "requests" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Fund Requests</h2>
              {!isAdmin && !isReadOnly && <Button onClick={() => setShowFundForm(true)}>💰 New Request</Button>}
            </div>
            {tabFilterUI}
            <Card>
              <RequestList requests={requests} isAdmin={isAdmin} engineerId={activeUser.id}
                filter={{ dateRange: tabDateFilter, status: filterStatus, engineer: filterEngineer }}
                onReview={req => setReviewItem(req)}
                onDelete={req => { setDeleteItem(req); setDeleteItemType("request"); }} 
                isReadOnly={isReadOnly} />
            </Card>
          </>
        )}

        {/* ── EXPENSES ── */}
        {tab === "expenses" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{isAdmin ? "All Expenses" : "My Expenses"}</h2>
              {!isAdmin && !isReadOnly && <Button onClick={() => { setEditExpense(null); setShowExpenseForm(true); }} disabled={availableBalance <= 0}>🧾 Add Expense</Button>}
            </div>
            {tabFilterUI}
            <Card>
              <ExpenseList expenses={isAdmin ? expenses : myExpenses}
                onEdit={e => { setEditExpense(e); setShowExpenseForm(true); }}
                onViewAttachment={setViewAttachment}
                onReview={exp => setReviewItem(exp)}
                onDelete={exp => { setDeleteItem(exp); setDeleteItemType("expense"); }}
                isAdmin={isAdmin}
                isReadOnly={isReadOnly}
                filter={{ dateRange: tabDateFilter, status: filterStatus, engineer: filterEngineer }} />
            </Card>
          </>
        )}

        {/* ── DATABASE (admin only) ── */}
        {tab === "database" && isAdmin && (
          <AdminDatabase
            users={allUsers} customers={customers}
            onSaveUser={saveUser} onDeleteUser={deleteUser}
            onSaveCustomer={saveCustomer} onDeleteCustomer={deleteCustomer}
          />
        )}
      </div>

      {/* ── MODALS ── */}
      {showFundForm && !isReadOnly && <FundRequestForm user={activeUser} onSubmit={addRequest} onClose={() => setShowFundForm(false)} customers={customers} />}
      {showExpenseForm && !isReadOnly && <ExpenseForm user={activeUser} availableBalance={editExpense ? availableBalance + editExpense.amount : availableBalance} onSubmit={addExpense} onClose={() => { setShowExpenseForm(false); setEditExpense(null); }} editItem={editExpense} customers={customers} />}
      {showReceivedFundModal && isAdmin && <ReceivedFundModal onSave={saveReceivedFund} onClose={() => { setShowReceivedFundModal(false); setEditReceivedFund(null); }} editItem={editReceivedFund} />}
      {showReportModal && isAdmin && <ExpenseReportModal engineers={engineers} expenses={expenses} receivedFunds={receivedFunds} requests={requests} onClose={() => setShowReportModal(false)} />}

      {reviewItem && !isReadOnly && (
        <AdminReviewModal item={reviewItem} type={reviewItem.type} onClose={() => setReviewItem(null)}
          onApprove={(id, amt, comment, origAmt) => approveItem(reviewItem.type === "expense" ? "expenses" : "requests", id, amt, comment, origAmt)}
          onReject={(id, comment) => rejectItem(reviewItem.type === "expense" ? "expenses" : "requests", id, comment)} />
      )}

      {deleteItem && !isReadOnly && (
        <ConfirmDeleteModal item={deleteItem} itemType={deleteItemType}
          onConfirm={(id) => {
            if (deleteItemType === "expense") deleteExpense(id);
            else if (deleteItemType === "request") deleteRequest(id);
            else if (deleteItemType === "received") deleteReceivedFund(id);
          }}
          onClose={() => { setDeleteItem(null); setDeleteItemType("expense"); }} />
      )}

      {viewAttachment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "auto", color: "var(--text-main)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>{viewAttachment.attachName}</strong>
              <div style={{ display: "flex", gap: 10 }}>
                <Button small variant="outline" onClick={() => downloadAttachment(viewAttachment)}>⬇️ Download</Button>
                <button onClick={() => setViewAttachment(null)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text-light)" }}>✕</button>
              </div>
            </div>
            <div style={{ padding: 20, textAlign: "center" }}>
              {viewAttachment.attachment.startsWith("data:image") ? <img src={viewAttachment.attachment} alt="receipt" style={{ maxWidth: "100%", borderRadius: 8 }} /> : <iframe src={viewAttachment.attachment} style={{ width: "100%", height: 500, border: "none" }} title="attachment" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}