import { useState, useEffect, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORIES = ["HVAC","Plumbing","Electrical","Appliances","Roofing","Landscaping","Structural","Safety","Other"];
const STATUS_OPTIONS = ["Scheduled","In Progress","Completed","Overdue"];
const PRIORITY = ["Low","Medium","High","Urgent"];
const HOME_TYPES = ["Single Family","Townhouse","Condo","Mobile Home","Multi-Family","Other"];

const CAT_ICONS = { HVAC:"🌡️", Plumbing:"🚿", Electrical:"⚡", Appliances:"🍳", Roofing:"🏚️", Landscaping:"🌿", Structural:"🧱", Safety:"🔒", Other:"🔧" };
const STATUS_STYLE = {
  "Scheduled":   { bg:"#EBF5FF", text:"#1A6FA0", border:"#93C5E8" },
  "In Progress": { bg:"#FFF8E6", text:"#92610A", border:"#F5CC76" },
  "Completed":   { bg:"#E8F6EE", text:"#1A7A44", border:"#7DCBA1" },
  "Overdue":     { bg:"#FDEEEE", text:"#B91C1C", border:"#F5A0A0" },
};
const PRIORITY_COLOR = { Low:"#6B8F71", Medium:"#E0A84A", High:"#D9622B", Urgent:"#B91C1C" };
const CHART_COLORS = ["#C1622B","#4A89B8","#6B8F71","#C9962A","#8B5CF6","#EC4899","#14B8A6","#F97316","#6366F1"];

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const SAMPLE = {
  profile: { name:"The Johnson Home", address:"123 Maple Street, Tampa, FL 33601", type:"Single Family", sqft:"2,150", year:"2004", bedrooms:"3", bathrooms:"2", notes:"Built 2004. Metal roof replaced 2021. Original HVAC." },
  tasks: [
    { id:1, title:"HVAC Filter Replacement", category:"HVAC", status:"Overdue", priority:"High", dueDate:"2026-05-01", cost:35, notes:"Use MERV-11 filters. Check blower housing.", vendor:"DIY", recurring:"Every 3 months" },
    { id:2, title:"Roof Inspection", category:"Roofing", status:"Completed", priority:"High", dueDate:"2026-03-15", cost:250, notes:"Annual inspection before storm season.", vendor:"Apex Roofing Co.", recurring:"Annually" },
    { id:3, title:"Water Heater Flush", category:"Plumbing", status:"Overdue", priority:"Medium", dueDate:"2026-04-01", cost:0, notes:"Flush sediment build-up from tank bottom.", vendor:"DIY", recurring:"Annually" },
    { id:4, title:"Smoke Detector Battery Check", category:"Safety", status:"Completed", priority:"Urgent", dueDate:"2026-01-01", cost:20, notes:"Test all 6 detectors. Replace batteries in hall unit.", vendor:"DIY", recurring:"Every 6 months" },
    { id:5, title:"Gutter Cleaning", category:"Landscaping", status:"Scheduled", priority:"Medium", dueDate:"2026-06-15", cost:150, notes:"Clear debris from gutters and downspouts.", vendor:"Green Yard Services", recurring:"Twice a year" },
    { id:6, title:"HVAC Annual Tune-up", category:"HVAC", status:"Scheduled", priority:"High", dueDate:"2026-07-01", cost:189, notes:"Full system check before summer.", vendor:"AirPros HVAC", recurring:"Annually" },
  ],
  warranties: [
    { id:1, item:"Samsung Refrigerator", model:"RF28R7351SR", purchaseDate:"2023-06-15", expiryDate:"2026-06-15", vendor:"Best Buy", cost:1899, notes:"5-year extended warranty purchased.", documentRef:"Kitchen drawer" },
    { id:2, item:"Lennox HVAC System", model:"XC21-036", purchaseDate:"2022-03-10", expiryDate:"2032-03-10", vendor:"AirPros HVAC", cost:8500, notes:"10-year parts, 5-year labor warranty.", documentRef:"Filing cabinet — Folder A" },
    { id:3, item:"Metal Roof — ABC Metal", model:"Standing Seam", purchaseDate:"2021-09-01", expiryDate:"2051-09-01", vendor:"Apex Roofing Co.", cost:18000, notes:"40-year manufacturer warranty on panels.", documentRef:"Google Drive > Home Docs" },
  ],
  expenses: [
    { id:1, description:"HVAC Annual Service", category:"HVAC", date:"2026-02-14", amount:189, vendor:"AirPros HVAC" },
    { id:2, description:"Kitchen Faucet Replacement", category:"Plumbing", date:"2026-01-22", amount:320, vendor:"Mike's Plumbing" },
    { id:3, description:"Exterior Paint Touch-up", category:"Structural", date:"2025-10-05", amount:640, vendor:"ColorPro Painters" },
    { id:4, description:"Gutter Cleaning", category:"Landscaping", date:"2025-11-18", amount:150, vendor:"Green Yard Services" },
    { id:5, description:"Electrical Panel Inspection", category:"Electrical", date:"2025-08-30", amount:275, vendor:"Bright Electric" },
    { id:6, description:"Smoke Detectors (6-pack)", category:"Safety", date:"2026-01-01", amount:65, vendor:"Home Depot" },
  ]
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@300;500;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --cream:#F7F4EF; --white:#FDFBF8; --stone:#E6E1D9; --mid:#C2B8AE;
  --dark:#2A2622; --brown:#7A5C3E; --rust:#C1622B; --rust-light:#FDF0EB;
  --sage:#5E8065; --gold:#C9962A; --sky:#4A89B8; --red:#B91C1C;
  --shadow:0 2px 12px rgba(42,38,34,.08),0 1px 3px rgba(42,38,34,.05);
  --shadow-lg:0 8px 32px rgba(42,38,34,.14);
  --r:14px; --r-sm:8px;
  --nav-h:60px; --header-h:60px;
}

body{background:var(--cream);font-family:'DM Sans',sans-serif;color:var(--dark);-webkit-font-smoothing:antialiased}
.app{min-height:100vh;display:flex;flex-direction:column}

/* ── HEADER ── */
.hdr{height:var(--header-h);background:var(--dark);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;position:sticky;top:0;z-index:200;gap:1rem}
.hdr-logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.hdr-logo .ico{font-size:1.35rem}
.hdr-logo .name{font-family:'Fraunces',serif;font-size:1.15rem;font-weight:500;color:#fff;letter-spacing:-.3px}
.hdr-logo .sub{font-size:.65rem;color:var(--mid);letter-spacing:1.5px;text-transform:uppercase}
.search-wrap{flex:1;max-width:400px;position:relative}
.search-wrap input{width:100%;padding:.45rem .9rem .45rem 2.2rem;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.15);border-radius:20px;font-size:.83rem;color:#fff;outline:none;transition:all .2s;font-family:'DM Sans',sans-serif}
.search-wrap input::placeholder{color:rgba(255,255,255,.4)}
.search-wrap input:focus{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3)}
.search-icon{position:absolute;left:.7rem;top:50%;transform:translateY(-50%);font-size:.85rem;pointer-events:none;opacity:.5}
.search-results{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--white);border-radius:var(--r-sm);box-shadow:var(--shadow-lg);border:1px solid var(--stone);overflow:hidden;z-index:300}
.sr-item{padding:.65rem 1rem;display:flex;align-items:center;gap:.7rem;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--stone);font-size:.83rem}
.sr-item:last-child{border-bottom:none}
.sr-item:hover{background:var(--cream)}
.sr-type{font-size:.65rem;padding:1px 7px;border-radius:10px;background:var(--stone);color:#7A7370;font-weight:600;white-space:nowrap}

/* ── NAV ── */
.nav{height:var(--nav-h);background:var(--white);border-bottom:1px solid var(--stone);display:flex;padding:0 1rem;position:sticky;top:var(--header-h);z-index:190;overflow-x:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.nav-btn{padding:0 1rem;height:100%;font-size:.8rem;font-weight:500;color:#9E9690;background:none;border:none;border-bottom:2.5px solid transparent;cursor:pointer;white-space:nowrap;transition:all .18s;display:flex;align-items:center;gap:6px;flex-shrink:0}
.nav-btn:hover{color:var(--dark)}
.nav-btn.active{color:var(--rust);border-bottom-color:var(--rust)}
.nav-badge{background:var(--red);color:#fff;border-radius:10px;font-size:.62rem;padding:1px 6px;font-weight:700;line-height:1.4}

/* ── MAIN ── */
.main{flex:1;padding:1.5rem;max-width:1160px;margin:0 auto;width:100%}

/* ── TOAST ── */
.toast-wrap{position:fixed;bottom:1.5rem;right:1.5rem;z-index:999;display:flex;flex-direction:column;gap:.5rem;pointer-events:none}
.toast{background:var(--dark);color:#fff;padding:.65rem 1.1rem;border-radius:var(--r-sm);font-size:.82rem;font-weight:500;box-shadow:var(--shadow-lg);opacity:0;transform:translateY(8px);transition:all .25s;pointer-events:none;max-width:300px}
.toast.show{opacity:1;transform:translateY(0)}
.toast.success{border-left:3px solid #6B8F71}
.toast.error{border-left:3px solid var(--red)}

/* ── STAT CARDS ── */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.85rem;margin-bottom:1.5rem}
.stat{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.1rem 1.3rem;box-shadow:var(--shadow);cursor:default;transition:box-shadow .18s}
.stat:hover{box-shadow:var(--shadow-lg)}
.stat-label{font-size:.68rem;letter-spacing:1.2px;text-transform:uppercase;color:#9E9690;font-weight:600;margin-bottom:5px}
.stat-val{font-family:'Fraunces',serif;font-size:1.9rem;font-weight:700;line-height:1}
.stat-sub{font-size:.72rem;color:#9E9690;margin-top:3px}

/* ── SECTION HEADER ── */
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;gap:.8rem;flex-wrap:wrap}
.sh-title{font-family:'Fraunces',serif;font-size:1.3rem;font-weight:500}
.sh-right{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}

/* ── SORT/FILTER ROW ── */
.toolbar{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.9rem}
.chip{padding:.3rem .85rem;border-radius:20px;font-size:.73rem;font-weight:500;border:1.5px solid var(--stone);background:var(--white);color:#9E9690;cursor:pointer;transition:all .15s;white-space:nowrap}
.chip:hover{border-color:var(--mid);color:var(--dark)}
.chip.on{border-color:var(--rust);background:var(--rust-light);color:var(--rust)}
.sort-select{padding:.3rem .7rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-size:.75rem;font-family:'DM Sans',sans-serif;color:var(--dark);background:var(--white);cursor:pointer;outline:none}
.sort-select:focus{border-color:var(--rust)}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:.55rem 1.1rem;border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.8rem;font-weight:500;border:none;cursor:pointer;transition:all .18s;white-space:nowrap}
.btn-primary{background:var(--rust);color:#fff}
.btn-primary:hover{background:#A8501F}
.btn-ghost{background:var(--stone);color:var(--dark)}
.btn-ghost:hover{background:var(--mid)}
.btn-sm{padding:.35rem .75rem;font-size:.73rem}
.btn-danger{background:#FDEEEE;color:var(--red)}
.btn-danger:hover{background:#F5A0A0}
.btn-success{background:#E8F6EE;color:#1A7A44}
.btn-success:hover{background:#c8ebd8}

/* ── CARDS ── */
.card{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);box-shadow:var(--shadow);padding:1.1rem 1.3rem;margin-bottom:.75rem;display:flex;align-items:flex-start;gap:.9rem;transition:box-shadow .18s}
.card:hover{box-shadow:var(--shadow-lg)}
.card-ico{font-size:1.4rem;width:40px;height:40px;background:var(--cream);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.card-body{flex:1;min-width:0}
.card-title-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px}
.card-title{font-weight:600;font-size:.92rem}
.card-meta{font-size:.76rem;color:#9E9690;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:3px}
.card-note{font-size:.77rem;color:#7A7370;margin-top:4px;line-height:1.45}
.card-actions{display:flex;gap:5px;flex-shrink:0;align-items:center}

/* ── BADGE ── */
.badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:.67rem;font-weight:700;border:1px solid;letter-spacing:.3px;white-space:nowrap}
.pdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}

/* ── MODAL ── */
.overlay{position:fixed;inset:0;background:rgba(42,38,34,.5);z-index:400;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)}
.modal{background:var(--white);border-radius:18px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 28px 64px rgba(42,38,34,.25);display:flex;flex-direction:column}
.modal-hdr{padding:1.3rem 1.6rem .9rem;border-bottom:1px solid var(--stone);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.modal-title{font-family:'Fraunces',serif;font-size:1.15rem;font-weight:600}
.modal-body{padding:1.2rem 1.6rem;flex:1;overflow-y:auto}
.modal-footer{padding:.9rem 1.6rem 1.3rem;display:flex;gap:.6rem;justify-content:flex-end;border-top:1px solid var(--stone);flex-shrink:0}

/* confirm dialog */
.confirm-body{padding:1.4rem 1.6rem;text-align:center}
.confirm-body .ci{font-size:2.5rem;margin-bottom:.8rem}
.confirm-body p{font-size:.9rem;color:#7A7370;margin-top:.4rem}

/* ── FORM ── */
.fg{display:grid;grid-template-columns:1fr 1fr;gap:.9rem}
.field{display:flex;flex-direction:column;gap:4px}
.field.s2{grid-column:span 2}
label{font-size:.7rem;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#7A7370}
input,select,textarea{width:100%;padding:.55rem .85rem;border:1.5px solid var(--stone);border-radius:var(--r-sm);font-family:'DM Sans',sans-serif;font-size:.85rem;color:var(--dark);background:var(--white);outline:none;transition:border-color .15s}
input:focus,select:focus,textarea:focus{border-color:var(--rust)}
textarea{resize:vertical;min-height:65px;line-height:1.5}

/* ── QUICK STATUS ── */
.qs-wrap{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.qs-btn{padding:2px 8px;border-radius:12px;font-size:.65rem;font-weight:700;border:1.5px solid transparent;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}

/* ── WARRANTY BAR ── */
.wbar{height:4px;border-radius:2px;background:var(--stone);margin-top:7px;overflow:hidden}
.wbar-fill{height:100%;border-radius:2px;transition:width .4s}

/* ── CHART ── */
.chart-wrap{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.2rem 1.4rem;margin-bottom:1.3rem;box-shadow:var(--shadow)}
.chart-title{font-size:.78rem;font-weight:600;color:#9E9690;letter-spacing:.8px;text-transform:uppercase;margin-bottom:1rem}
.bar-row{display:flex;align-items:center;gap:.8rem;margin-bottom:.6rem}
.bar-label{font-size:.75rem;min-width:90px;text-align:right;color:#7A7370}
.bar-track{flex:1;height:20px;background:var(--cream);border-radius:4px;overflow:hidden;position:relative}
.bar-fill{height:100%;border-radius:4px;display:flex;align-items:center;padding-left:8px;font-size:.68rem;font-weight:700;color:#fff;transition:width .6s;white-space:nowrap;overflow:hidden}
.bar-amt{font-size:.72rem;min-width:50px;text-align:left;color:var(--dark);font-weight:600}

/* ── PROFILE ── */
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.2rem}
.profile-field{background:var(--white);border:1px solid var(--stone);border-radius:var(--r-sm);padding:.9rem 1.1rem}
.pf-label{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#9E9690;font-weight:600;margin-bottom:3px}
.pf-val{font-size:.92rem;font-weight:500;color:var(--dark)}

/* ── DASH UPCOMING ── */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-top:.3rem}
.panel{background:var(--white);border-radius:var(--r);border:1px solid var(--stone);padding:1.1rem 1.3rem;box-shadow:var(--shadow)}
.panel-title{font-family:'Fraunces',serif;font-size:1rem;font-weight:500;margin-bottom:.9rem}
.up-item{display:flex;align-items:center;gap:.8rem;padding:.65rem .85rem;border:1px solid var(--stone);border-radius:10px;margin-bottom:.5rem;transition:box-shadow .15s;cursor:default}
.up-item:last-child{margin-bottom:0}
.up-item:hover{box-shadow:var(--shadow)}
.up-days{font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap}
.empty{text-align:center;padding:2.5rem 1rem;color:#9E9690}
.empty .ei{font-size:2.2rem;margin-bottom:.7rem}
.empty p{font-size:.85rem}

@media(max-width:640px){
  .hdr{padding:0 1rem}
  .main{padding:1rem}
  .fg{grid-template-columns:1fr}
  .field.s2{grid-column:span 1}
  .card{flex-direction:column}
  .card-actions{align-self:flex-end}
  .stats{grid-template-columns:1fr 1fr}
  .two-col{grid-template-columns:1fr}
  .search-wrap{max-width:none}
  .hdr-date{display:none}
}
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt$ = v => "$" + Number(v||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtD = d => { if(!d) return "—"; const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const daysTo = d => { if(!d) return null; return Math.ceil((new Date(d+"T00:00:00")-new Date())/86400000); };
const wPct = (p,e) => { const start=new Date(p+"T00:00:00"),end=new Date(e+"T00:00:00"),now=new Date(); return Math.min(100,Math.max(0,Math.round(((now-start)/(end-start))*100))); };

// ─── TOAST HOOK ───────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type="success") => {
    const id = Date.now();
    setToasts(t => [...t, {id, msg, type, visible:false}]);
    setTimeout(() => setToasts(t => t.map(x => x.id===id ? {...x, visible:true} : x)), 30);
    setTimeout(() => setToasts(t => t.map(x => x.id===id ? {...x, visible:false} : x)), 2800);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 3200);
  };
  return { toasts, show };
}

// ─── TOAST RENDERER ───────────────────────────────────────────────────────────
function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type} ${t.visible?"show":""}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function Confirm({ message, onConfirm, onCancel }) {
  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget && onCancel()}>
      <div className="modal" style={{maxWidth:340}}>
        <div className="confirm-body">
          <div className="ci">🗑️</div>
          <strong>Are you sure?</strong>
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
function Modal({ title, onClose, onSave, children, saveLabel="Save" }) {
  return (
    <div className="overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── FORMS ────────────────────────────────────────────────────────────────────
function TaskForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Task Title *</label><input value={data.title||""} onChange={e=>f("title",e.target.value)} placeholder="e.g. Replace HVAC Filter" /></div>
      <div className="field"><label>Category</label><select value={data.category||""} onChange={e=>f("category",e.target.value)}><option value="">Select…</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Priority</label><select value={data.priority||""} onChange={e=>f("priority",e.target.value)}><option value="">Select…</option>{PRIORITY.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="field"><label>Status</label><select value={data.status||""} onChange={e=>f("status",e.target.value)}><option value="">Select…</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="field"><label>Due Date</label><input type="date" value={data.dueDate||""} onChange={e=>f("dueDate",e.target.value)} /></div>
      <div className="field"><label>Est. Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Vendor / Contractor</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} placeholder="DIY or company name" /></div>
      <div className="field"><label>Recurring Schedule</label><input value={data.recurring||""} onChange={e=>f("recurring",e.target.value)} placeholder="e.g. Every 3 months" /></div>
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Details, part numbers, access instructions…" /></div>
    </div>
  );
}

function WarrantyForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Item / Appliance *</label><input value={data.item||""} onChange={e=>f("item",e.target.value)} placeholder="e.g. Samsung Refrigerator" /></div>
      <div className="field"><label>Model / Serial #</label><input value={data.model||""} onChange={e=>f("model",e.target.value)} /></div>
      <div className="field"><label>Vendor / Store</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} /></div>
      <div className="field"><label>Purchase Date</label><input type="date" value={data.purchaseDate||""} onChange={e=>f("purchaseDate",e.target.value)} /></div>
      <div className="field"><label>Warranty Expiry</label><input type="date" value={data.expiryDate||""} onChange={e=>f("expiryDate",e.target.value)} /></div>
      <div className="field"><label>Purchase Cost ($)</label><input type="number" value={data.cost||""} onChange={e=>f("cost",e.target.value)} /></div>
      <div className="field s2"><label>Document Location</label><input value={data.documentRef||""} onChange={e=>f("documentRef",e.target.value)} placeholder="e.g. Filing Cabinet, Google Drive folder" /></div>
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Coverage details, claim process, contact info…" /></div>
    </div>
  );
}

function ExpenseForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Description *</label><input value={data.description||""} onChange={e=>f("description",e.target.value)} placeholder="e.g. HVAC Service Call" /></div>
      <div className="field"><label>Category</label><select value={data.category||""} onChange={e=>f("category",e.target.value)}><option value="">Select…</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="field"><label>Amount ($)</label><input type="number" value={data.amount||""} onChange={e=>f("amount",e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Date</label><input type="date" value={data.date||""} onChange={e=>f("date",e.target.value)} /></div>
      <div className="field"><label>Vendor / Contractor</label><input value={data.vendor||""} onChange={e=>f("vendor",e.target.value)} /></div>
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Invoice #, notes…" /></div>
    </div>
  );
}

function ProfileForm({ data, onChange }) {
  const f = (k,v) => onChange({...data,[k]:v});
  return (
    <div className="fg">
      <div className="field s2"><label>Home Name / Nickname</label><input value={data.name||""} onChange={e=>f("name",e.target.value)} placeholder="e.g. The Johnson Home" /></div>
      <div className="field s2"><label>Address</label><input value={data.address||""} onChange={e=>f("address",e.target.value)} placeholder="123 Main St, City, State ZIP" /></div>
      <div className="field"><label>Home Type</label><select value={data.type||""} onChange={e=>f("type",e.target.value)}><option value="">Select…</option>{HOME_TYPES.map(h=><option key={h}>{h}</option>)}</select></div>
      <div className="field"><label>Year Built</label><input type="number" value={data.year||""} onChange={e=>f("year",e.target.value)} placeholder="e.g. 1998" /></div>
      <div className="field"><label>Square Footage</label><input value={data.sqft||""} onChange={e=>f("sqft",e.target.value)} placeholder="e.g. 2,150" /></div>
      <div className="field"><label>Bedrooms</label><input type="number" value={data.bedrooms||""} onChange={e=>f("bedrooms",e.target.value)} /></div>
      <div className="field"><label>Bathrooms</label><input type="number" value={data.bathrooms||""} onChange={e=>f("bathrooms",e.target.value)} /></div>
      <div className="field s2"><label>Notes</label><textarea value={data.notes||""} onChange={e=>f("notes",e.target.value)} placeholder="Key systems, important info, past renovations…" /></div>
    </div>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
function SearchBar({ tasks, warranties, expenses, onNavigate }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = q.trim().length < 2 ? [] : [
    ...tasks.filter(t => t.title?.toLowerCase().includes(q.toLowerCase()) || t.category?.toLowerCase().includes(q.toLowerCase())).slice(0,3).map(t => ({type:"Task",icon:CAT_ICONS[t.category]||"🔧",label:t.title,sub:t.status,tab:"tasks"})),
    ...warranties.filter(w => w.item?.toLowerCase().includes(q.toLowerCase())).slice(0,2).map(w => ({type:"Warranty",icon:"📋",label:w.item,sub:w.vendor,tab:"warranties"})),
    ...expenses.filter(e => e.description?.toLowerCase().includes(q.toLowerCase())).slice(0,2).map(e => ({type:"Expense",icon:"💲",label:e.description,sub:fmt$(e.amount),tab:"expenses"})),
  ];

  return (
    <div className="search-wrap" ref={ref}>
      <span className="search-icon">🔍</span>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search tasks, warranties, expenses…"
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r,i) => (
            <div key={i} className="sr-item" onClick={() => { onNavigate(r.tab); setQ(""); setOpen(false); }}>
              <span>{r.icon}</span>
              <span style={{flex:1,fontWeight:500}}>{r.label}</span>
              <span style={{fontSize:".72rem",color:"#9E9690"}}>{r.sub}</span>
              <span className="sr-type">{r.type}</span>
            </div>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div className="search-results"><div className="sr-item" style={{color:"#9E9690",justifyContent:"center"}}>No results found</div></div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ tasks, warranties, expenses, profile, onNavigate }) {
  const overdue = tasks.filter(t => t.status==="Overdue").length;
  const upcoming = tasks.filter(t => { const d=daysTo(t.dueDate); return d!==null&&d>=0&&d<=30&&t.status!=="Completed"; }).sort((a,b)=>daysTo(a.dueDate)-daysTo(b.dueDate));
  const totalSpend = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const yrSpend = expenses.filter(e=>e.date?.startsWith("2026")).reduce((s,e)=>s+Number(e.amount||0),0);
  const expiringW = warranties.filter(w=>{ const d=daysTo(w.expiryDate); return d!==null&&d>=0&&d<=90; });
  const activeW = warranties.filter(w=>{ const d=daysTo(w.expiryDate); return d!==null&&d>=0; }).length;

  return (
    <div>
      {profile.name && <div style={{marginBottom:"1.2rem"}}><h1 style={{fontFamily:"'Fraunces',serif",fontSize:"1.6rem",fontWeight:500}}>{profile.name}</h1><p style={{fontSize:".82rem",color:"#9E9690",marginTop:"2px"}}>{profile.address}</p></div>}

      <div className="stats">
        <div className="stat" onClick={()=>onNavigate("tasks")} style={{cursor:"pointer"}}>
          <div className="stat-label">Total Tasks</div>
          <div className="stat-val">{tasks.length}</div>
          <div className="stat-sub">{tasks.filter(t=>t.status==="Completed").length} completed</div>
        </div>
        <div className="stat" onClick={()=>onNavigate("tasks")} style={{cursor:"pointer"}}>
          <div className="stat-label">Overdue</div>
          <div className="stat-val" style={{color:overdue>0?"#B91C1C":"inherit"}}>{overdue}</div>
          <div className="stat-sub">need attention</div>
        </div>
        <div className="stat" onClick={()=>onNavigate("expenses")} style={{cursor:"pointer"}}>
          <div className="stat-label">2026 Spend</div>
          <div className="stat-val" style={{fontSize:"1.5rem"}}>{fmt$(yrSpend)}</div>
          <div className="stat-sub">{fmt$(totalSpend)} all time</div>
        </div>
        <div className="stat" onClick={()=>onNavigate("warranties")} style={{cursor:"pointer"}}>
          <div className="stat-label">Active Warranties</div>
          <div className="stat-val">{activeW}</div>
          <div className="stat-sub">{expiringW.length} expiring ≤ 90 days</div>
        </div>
        <div className="stat" onClick={()=>onNavigate("tasks")} style={{cursor:"pointer"}}>
          <div className="stat-label">Due This Month</div>
          <div className="stat-val">{upcoming.length}</div>
          <div className="stat-sub">next 30 days</div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">📅 Upcoming Tasks</div>
          {upcoming.length===0 && <div className="empty"><div className="ei">✅</div><p>Nothing due in the next 30 days!</p></div>}
          {upcoming.slice(0,6).map(t => {
            const d = daysTo(t.dueDate);
            return (
              <div className="up-item" key={t.id}>
                <span style={{fontSize:"1.2rem"}}>{CAT_ICONS[t.category]||"🔧"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:".85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                  <div style={{fontSize:".72rem",color:"#9E9690"}}>{fmtD(t.dueDate)}</div>
                </div>
                <div className="up-days" style={{background:d===0?"#FDEEEE":d<=7?"#FFF8E6":"#E8F5FF",color:d===0?"#B91C1C":d<=7?"#92610A":"#1A6FA0"}}>
                  {d===0?"Today":`${d}d`}
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <div className="panel-title">📋 Warranties Expiring Soon</div>
          {expiringW.length===0 && <div className="empty"><div className="ei">🛡️</div><p>No warranties expiring in 90 days</p></div>}
          {expiringW.sort((a,b)=>daysTo(a.expiryDate)-daysTo(b.expiryDate)).slice(0,5).map(w => {
            const d = daysTo(w.expiryDate);
            return (
              <div className="up-item" key={w.id}>
                <span style={{fontSize:"1.2rem"}}>📋</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:".85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.item}</div>
                  <div style={{fontSize:".72rem",color:"#9E9690"}}>Expires {fmtD(w.expiryDate)}</div>
                </div>
                <div className="up-days" style={{background:d<=30?"#FDEEEE":"#FFF8E6",color:d<=30?"#B91C1C":"#92610A"}}>
                  {d}d left
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
function Tasks({ tasks, setTasks, toast }) {
  const [statusF, setStatusF] = useState("All");
  const [catF, setCatF] = useState("All");
  const [sort, setSort] = useState("dueDate");
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const openNew = () => { setEditData({status:"Scheduled",priority:"Medium",dueDate:new Date().toISOString().slice(0,10)}); setEditId(null); setModal(true); };
  const openEdit = t => { setEditData({...t}); setEditId(t.id); setModal(true); };
  const save = () => {
    if(!editData.title?.trim()) return;
    if(editId) { setTasks(tasks.map(t=>t.id===editId?{...editData,id:editId}:t)); toast("Task updated ✓"); }
    else { setTasks([...tasks,{...editData,id:Date.now()}]); toast("Task added ✓"); }
    setModal(false);
  };
  const del = id => { setConfirm(id); };
  const confirmDel = () => { setTasks(tasks.filter(t=>t.id!==confirm)); setConfirm(null); toast("Task deleted","error"); };
  const toggleStatus = (t, s) => { setTasks(tasks.map(x=>x.id===t.id?{...x,status:s}:x)); toast(`Marked as ${s} ✓`); };

  let filtered = tasks.filter(t =>
    (statusF==="All"||t.status===statusF) && (catF==="All"||t.category===catF)
  );
  filtered = [...filtered].sort((a,b) => {
    if(sort==="dueDate") return new Date(a.dueDate||"9999")-new Date(b.dueDate||"9999");
    if(sort==="priority") return PRIORITY.indexOf(b.priority)-PRIORITY.indexOf(a.priority);
    if(sort==="title") return (a.title||"").localeCompare(b.title||"");
    if(sort==="cost") return Number(b.cost||0)-Number(a.cost||0);
    return 0;
  });

  return (
    <div>
      <div className="sh">
        <span className="sh-title">Maintenance Tasks</span>
        <div className="sh-right">
          <span style={{fontSize:".78rem",color:"#9E9690"}}>{filtered.length} of {tasks.length}</span>
          <button className="btn btn-primary" onClick={openNew}>＋ Add Task</button>
        </div>
      </div>

      <div className="toolbar">
        {["All",...STATUS_OPTIONS].map(s=><button key={s} className={`chip ${statusF===s?"on":""}`} onClick={()=>setStatusF(s)}>{s}</button>)}
        <select className="sort-select" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="dueDate">Sort: Due Date</option>
          <option value="priority">Sort: Priority</option>
          <option value="title">Sort: A–Z</option>
          <option value="cost">Sort: Cost</option>
        </select>
      </div>
      <div className="toolbar">
        {["All",...CATEGORIES].map(c=><button key={c} className={`chip ${catF===c?"on":""}`} onClick={()=>setCatF(c)}>{CAT_ICONS[c]||""} {c}</button>)}
      </div>

      {filtered.length===0 && <div className="empty"><div className="ei">🔧</div><p>No tasks match your filters.</p></div>}
      {filtered.map(t => {
        const sc = STATUS_STYLE[t.status]||STATUS_STYLE.Scheduled;
        const d = daysTo(t.dueDate);
        return (
          <div className="card" key={t.id}>
            <div className="card-ico">{CAT_ICONS[t.category]||"🔧"}</div>
            <div className="card-body">
              <div className="card-title-row">
                <span className="card-title">{t.title}</span>
                <span className="badge" style={{background:sc.bg,color:sc.text,borderColor:sc.border}}>{t.status}</span>
                <span className="pdot" style={{background:PRIORITY_COLOR[t.priority]||"#999"}} title={t.priority+" priority"} />
                {t.priority==="Urgent" && <span style={{fontSize:".68rem",fontWeight:700,color:"#B91C1C"}}>URGENT</span>}
              </div>
              <div className="card-meta">
                {t.category && <span>{t.category}</span>}
                {t.dueDate && <span style={{color:d!==null&&d<0?"#B91C1C":d===0?"#92610A":"inherit"}}>📅 {fmtD(t.dueDate)}{d!==null&&d<0?" (overdue)":d===0?" (today)":""}</span>}
                {t.vendor && <span>👤 {t.vendor}</span>}
                {t.cost>0 && <span>{fmt$(t.cost)}</span>}
                {t.recurring && <span>🔁 {t.recurring}</span>}
              </div>
              {t.notes && <div className="card-note">{t.notes}</div>}
              <div className="qs-wrap">
                {STATUS_OPTIONS.filter(s=>s!==t.status).map(s => {
                  const sc2=STATUS_STYLE[s];
                  return <button key={s} className="qs-btn" style={{background:sc2.bg,color:sc2.text,borderColor:sc2.border}} onClick={()=>toggleStatus(t,s)}>→ {s}</button>;
                })}
              </div>
            </div>
            <div className="card-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(t)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>del(t.id)}>Delete</button>
            </div>
          </div>
        );
      })}

      {modal && <Modal title={editId?"Edit Task":"New Task"} onClose={()=>setModal(false)} onSave={save}><TaskForm data={editData} onChange={setEditData}/></Modal>}
      {confirm && <Confirm message="This task will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

// ─── WARRANTIES ───────────────────────────────────────────────────────────────
function Warranties({ warranties, setWarranties, toast }) {
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState("All");

  const openNew = () => { setEditData({}); setEditId(null); setModal(true); };
  const openEdit = w => { setEditData({...w}); setEditId(w.id); setModal(true); };
  const save = () => {
    if(!editData.item?.trim()) return;
    if(editId) { setWarranties(warranties.map(w=>w.id===editId?{...editData,id:editId}:w)); toast("Warranty updated ✓"); }
    else { setWarranties([...warranties,{...editData,id:Date.now()}]); toast("Warranty added ✓"); }
    setModal(false);
  };
  const confirmDel = () => { setWarranties(warranties.filter(w=>w.id!==confirm)); setConfirm(null); toast("Warranty deleted","error"); };

  let list = [...warranties];
  if(filter==="Active") list = list.filter(w=>{ const d=daysTo(w.expiryDate); return d!==null&&d>=0; });
  if(filter==="Expiring Soon") list = list.filter(w=>{ const d=daysTo(w.expiryDate); return d!==null&&d>=0&&d<=90; });
  if(filter==="Expired") list = list.filter(w=>{ const d=daysTo(w.expiryDate); return d!==null&&d<0; });
  list = list.sort((a,b)=>new Date(a.expiryDate)-new Date(b.expiryDate));

  return (
    <div>
      <div className="sh">
        <span className="sh-title">Warranties & Documents</span>
        <button className="btn btn-primary" onClick={openNew}>＋ Add Warranty</button>
      </div>
      <div className="toolbar">
        {["All","Active","Expiring Soon","Expired"].map(f=><button key={f} className={`chip ${filter===f?"on":""}`} onClick={()=>setFilter(f)}>{f}</button>)}
      </div>

      {list.length===0 && <div className="empty"><div className="ei">📄</div><p>No warranties match this filter.</p></div>}
      {list.map(w => {
        const d = daysTo(w.expiryDate);
        const expired = d!==null&&d<0;
        const soon = d!==null&&d>=0&&d<=90;
        const pct = w.purchaseDate&&w.expiryDate ? wPct(w.purchaseDate,w.expiryDate) : 0;
        return (
          <div className="card" key={w.id}>
            <div className="card-ico">📋</div>
            <div className="card-body">
              <div className="card-title-row">
                <span className="card-title">{w.item}</span>
                {expired && <span className="badge" style={{background:"#FDEEEE",color:"#B91C1C",borderColor:"#F5A0A0"}}>Expired</span>}
                {soon && !expired && <span className="badge" style={{background:"#FFF8E6",color:"#92610A",borderColor:"#F5CC76"}}>Expiring Soon</span>}
                {!expired && !soon && d!==null && <span className="badge" style={{background:"#E8F6EE",color:"#1A7A44",borderColor:"#7DCBA1"}}>Active</span>}
              </div>
              <div className="card-meta">
                {w.model && <span>Model: {w.model}</span>}
                {w.vendor && <span>🏪 {w.vendor}</span>}
                {w.purchaseDate && <span>Purchased: {fmtD(w.purchaseDate)}</span>}
                {w.expiryDate && <span style={{color:expired?"#B91C1C":soon?"#92610A":"inherit"}}>Expires: {fmtD(w.expiryDate)}{expired?" (EXPIRED)":soon?` (${d} days)`:"" }</span>}
                {w.cost>0 && <span>{fmt$(w.cost)}</span>}
                {w.documentRef && <span>📁 {w.documentRef}</span>}
              </div>
              {w.notes && <div className="card-note">{w.notes}</div>}
              {w.purchaseDate && w.expiryDate && (
                <div style={{marginTop:"8px"}}>
                  <div style={{fontSize:".68rem",color:"#9E9690",marginBottom:"3px"}}>{expired?"Expired":`${d} days remaining`}</div>
                  <div className="wbar"><div className="wbar-fill" style={{width:`${pct}%`,background:expired?"#B91C1C":soon?"#E0A84A":"#5E8065"}} /></div>
                </div>
              )}
            </div>
            <div className="card-actions">
              <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(w)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={()=>setConfirm(w.id)}>Delete</button>
            </div>
          </div>
        );
      })}

      {modal && <Modal title={editId?"Edit Warranty":"New Warranty"} onClose={()=>setModal(false)} onSave={save}><WarrantyForm data={editData} onChange={setEditData}/></Modal>}
      {confirm && <Confirm message="This warranty record will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
function Expenses({ expenses, setExpenses, toast }) {
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editId, setEditId] = useState(null);
  const [catF, setCatF] = useState("All");
  const [confirm, setConfirm] = useState(null);

  const openNew = () => { setEditData({date:new Date().toISOString().slice(0,10)}); setEditId(null); setModal(true); };
  const openEdit = e => { setEditData({...e}); setEditId(e.id); setModal(true); };
  const save = () => {
    if(!editData.description?.trim()) return;
    if(editId) { setExpenses(expenses.map(e=>e.id===editId?{...editData,id:editId}:e)); toast("Expense updated ✓"); }
    else { setExpenses([...expenses,{...editData,id:Date.now()}]); toast("Expense logged ✓"); }
    setModal(false);
  };
  const confirmDel = () => { setExpenses(expenses.filter(e=>e.id!==confirm)); setConfirm(null); toast("Expense deleted","error"); };

  const filtered = catF==="All" ? expenses : expenses.filter(e=>e.category===catF);
  const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const total = filtered.reduce((s,e)=>s+Number(e.amount||0),0);

  // bar chart data
  const bycat = {};
  expenses.forEach(e=>{ bycat[e.category]=(bycat[e.category]||0)+Number(e.amount||0); });
  const chartData = Object.entries(bycat).sort((a,b)=>b[1]-a[1]);
  const maxVal = chartData[0]?.[1]||1;

  return (
    <div>
      <div className="sh">
        <span className="sh-title">Expense Log</span>
        <div className="sh-right">
          <span style={{fontFamily:"'Fraunces',serif",fontSize:"1.1rem",color:"#5E8065",fontWeight:700}}>{fmt$(total)}</span>
          <button className="btn btn-primary" onClick={openNew}>＋ Log Expense</button>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-wrap">
          <div className="chart-title">Spending by Category</div>
          {chartData.map(([cat, amt], i) => (
            <div key={cat} className="bar-row">
              <div className="bar-label">{CAT_ICONS[cat]||"🔧"} {cat}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{width:`${(amt/maxVal)*100}%`, background:CHART_COLORS[i%CHART_COLORS.length]}}>
                  {(amt/maxVal)*100 > 18 && fmt$(amt)}
                </div>
              </div>
              <div className="bar-amt">{(amt/maxVal)*100<=18?fmt$(amt):""}</div>
            </div>
          ))}
        </div>
      )}

      <div className="toolbar">
        {["All",...CATEGORIES].map(c=><button key={c} className={`chip ${catF===c?"on":""}`} onClick={()=>setCatF(c)}>{c}</button>)}
      </div>

      {sorted.length===0 ? (
        <div className="empty"><div className="ei">💲</div><p>No expenses yet. Start tracking your home costs!</p></div>
      ) : (
        <div style={{background:"var(--white)",borderRadius:"var(--r)",border:"1px solid var(--stone)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:".84rem"}}>
              <thead>
                <tr>
                  {["Description","Category","Date","Vendor","Amount",""].map(h=>(
                    <th key={h} style={{textAlign:h==="Amount"?"right":"left",padding:".65rem 1rem",fontSize:".68rem",letterSpacing:"1px",textTransform:"uppercase",color:"#9E9690",borderBottom:"1px solid var(--stone)",background:"var(--cream)",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(e=>(
                  <tr key={e.id} style={{borderBottom:"1px solid var(--stone)"}}>
                    <td style={{padding:".85rem 1rem",fontWeight:500}}>{e.description}</td>
                    <td style={{padding:".85rem 1rem"}}><span style={{fontSize:".77rem"}}>{CAT_ICONS[e.category]||""} {e.category}</span></td>
                    <td style={{padding:".85rem 1rem",fontSize:".8rem",color:"#7A7370",whiteSpace:"nowrap"}}>{fmtD(e.date)}</td>
                    <td style={{padding:".85rem 1rem",fontSize:".8rem",color:"#7A7370"}}>{e.vendor||"—"}</td>
                    <td style={{padding:".85rem 1rem",textAlign:"right",fontWeight:700,fontFamily:"'Fraunces',serif"}}>{fmt$(e.amount)}</td>
                    <td style={{padding:".85rem 1rem"}}>
                      <div style={{display:"flex",gap:"4px",justifyContent:"flex-end"}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(e)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>setConfirm(e.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{padding:".85rem 1rem",fontWeight:700,fontSize:".82rem",color:"#7A7370",borderTop:"2px solid var(--stone)"}}>Total ({filtered.length} records)</td>
                  <td style={{padding:".85rem 1rem",textAlign:"right",fontWeight:700,fontFamily:"'Fraunces',serif",fontSize:"1rem",color:"#5E8065",borderTop:"2px solid var(--stone)"}}>{fmt$(total)}</td>
                  <td style={{borderTop:"2px solid var(--stone)"}}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <Modal title={editId?"Edit Expense":"Log Expense"} onClose={()=>setModal(false)} onSave={save}><ExpenseForm data={editData} onChange={setEditData}/></Modal>}
      {confirm && <Confirm message="This expense record will be permanently deleted." onConfirm={confirmDel} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

// ─── HOME PROFILE ─────────────────────────────────────────────────────────────
function Profile({ profile, setProfile, tasks, expenses, warranties, toast }) {
  const [modal, setModal] = useState(false);
  const [editData, setEditData] = useState({});

  const openEdit = () => { setEditData({...profile}); setModal(true); };
  const save = () => { setProfile(editData); setModal(false); toast("Home profile saved ✓"); };

  const fields = [
    {label:"Home Type", val:profile.type},
    {label:"Year Built", val:profile.year},
    {label:"Square Footage", val:profile.sqft ? profile.sqft+" sq ft" : null},
    {label:"Bedrooms", val:profile.bedrooms},
    {label:"Bathrooms", val:profile.bathrooms},
  ];

  const totalCost = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const activeW = warranties.filter(w=>{ const d=daysTo(w.expiryDate); return d!==null&&d>=0; }).length;

  return (
    <div>
      <div className="sh">
        <span className="sh-title">{profile.name||"My Home"}</span>
        <button className="btn btn-primary" onClick={openEdit}>✏️ Edit Profile</button>
      </div>

      {profile.address && <p style={{fontSize:".85rem",color:"#9E9690",marginBottom:"1.2rem"}}>📍 {profile.address}</p>}

      <div className="profile-grid">
        {fields.map(f=>f.val&&(
          <div key={f.label} className="profile-field">
            <div className="pf-label">{f.label}</div>
            <div className="pf-val">{f.val}</div>
          </div>
        ))}
      </div>

      {profile.notes && (
        <div style={{background:"var(--white)",border:"1px solid var(--stone)",borderRadius:"var(--r-sm)",padding:"1rem 1.2rem",marginBottom:"1.2rem"}}>
          <div className="pf-label" style={{marginBottom:"6px"}}>Notes</div>
          <p style={{fontSize:".87rem",lineHeight:1.6,color:"var(--dark)"}}>{profile.notes}</p>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:".85rem",marginTop:"1rem"}}>
        {[
          {label:"Total Tasks", val:tasks.length, sub:"maintenance records", color:"var(--sky)"},
          {label:"Active Warranties", val:activeW, sub:"items covered", color:"#5E8065"},
          {label:"Lifetime Spend", val:fmt$(totalCost), sub:"tracked expenses", color:"var(--rust)"},
          {label:"Completed Tasks", val:tasks.filter(t=>t.status==="Completed").length, sub:"done", color:"#5E8065"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--white)",border:"1px solid var(--stone)",borderRadius:"var(--r)",padding:"1rem 1.2rem",boxShadow:"var(--shadow)"}}>
            <div className="stat-label">{s.label}</div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.7rem",fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {!profile.name && (
        <div style={{textAlign:"center",padding:"3rem",background:"var(--white)",borderRadius:"var(--r)",border:"2px dashed var(--stone)",marginTop:"1rem"}}>
          <div style={{fontSize:"2.5rem",marginBottom:".8rem"}}>🏡</div>
          <strong style={{fontSize:"1rem"}}>Set up your home profile</strong>
          <p style={{fontSize:".85rem",color:"#9E9690",marginTop:".4rem",marginBottom:"1rem"}}>Add your home's details to personalize the app</p>
          <button className="btn btn-primary" onClick={openEdit}>Get Started</button>
        </div>
      )}

      {modal && <Modal title="Edit Home Profile" onClose={()=>setModal(false)} onSave={save}><ProfileForm data={editData} onChange={setEditData}/></Modal>}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [tasks, setTasks] = useState(SAMPLE.tasks);
  const [warranties, setWarranties] = useState(SAMPLE.warranties);
  const [expenses, setExpenses] = useState(SAMPLE.expenses);
  const [profile, setProfile] = useState(SAMPLE.profile);
  const { toasts, show: toast } = useToast();

  const overdue = tasks.filter(t=>t.status==="Overdue").length;

  const TABS = [
    {id:"dashboard", label:"Dashboard", icon:"⌂"},
    {id:"tasks", label:"Tasks", icon:"✓", badge:overdue},
    {id:"warranties", label:"Warranties", icon:"🛡️"},
    {id:"expenses", label:"Expenses", icon:"$"},
    {id:"profile", label:"My Home", icon:"🏡"},
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="hdr">
          <div className="hdr-logo">
            <span className="ico">🏡</span>
            <div>
              <div className="name">HomeKeep</div>
              <div className="sub">Maintenance Manager</div>
            </div>
          </div>
          <SearchBar tasks={tasks} warranties={warranties} expenses={expenses} onNavigate={setTab} />
          <div className="hdr-date" style={{fontSize:".75rem",color:"var(--mid)",flexShrink:0}}>
            {new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}
          </div>
        </header>

        <nav className="nav">
          {TABS.map(t=>(
            <button key={t.id} className={`nav-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              <span>{t.icon}</span> {t.label}
              {t.badge>0 && <span className="nav-badge">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <main className="main">
          {tab==="dashboard" && <Dashboard tasks={tasks} warranties={warranties} expenses={expenses} profile={profile} onNavigate={setTab}/>}
          {tab==="tasks" && <Tasks tasks={tasks} setTasks={setTasks} toast={toast}/>}
          {tab==="warranties" && <Warranties warranties={warranties} setWarranties={setWarranties} toast={toast}/>}
          {tab==="expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} toast={toast}/>}
          {tab==="profile" && <Profile profile={profile} setProfile={setProfile} tasks={tasks} expenses={expenses} warranties={warranties} toast={toast}/>}
        </main>

        <Toasts toasts={toasts}/>
      </div>
    </>
  );
}
