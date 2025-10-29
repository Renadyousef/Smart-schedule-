import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ===== Utility functions ===== */
function readJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function toInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; }
function b64urlDecode(str) {
  try {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return decodeURIComponent(escape(atob(base64)));
  } catch { return ""; }
}
function decodeJwt(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(b64urlDecode(payload));
  } catch { return null; }
}
function getAuth() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  const directKeys = [
    localStorage.getItem("userId"),
    localStorage.getItem("UserID"),
    localStorage.getItem("uid"),
    sessionStorage.getItem("userId"),
    sessionStorage.getItem("UserID"),
    sessionStorage.getItem("uid"),
  ].map(toInt).filter(Boolean);
  if (directKeys.length) return { token, registrarId: directKeys[0] };

  const objectKeys = ["user", "profile", "account", "currentUser", "session", "auth", "registrar"];
  for (const src of [localStorage, sessionStorage]) {
    for (const k of objectKeys) {
      const obj = readJSON(src.getItem(k));
      if (!obj) continue;
      const candidates = [
        obj?.UserID, obj?.userId, obj?.id, obj?.ID, obj?.uid,
        obj?.user?.UserID, obj?.user?.userId, obj?.user?.id,
        obj?.data?.user?.id, obj?.data?.user?.userId,
      ].map(toInt).filter(Boolean);
      if (candidates.length) return { token, registrarId: candidates[0] };
    }
  }

  if (token) {
    const p = decodeJwt(token) || {};
    const jwtId = [p.userId, p.uid, p.id, p.sub].map(toInt).filter(Boolean)[0];
    if (jwtId) return { token, registrarId: jwtId };
  }

  return { token, registrarId: undefined };
}

/* ===== Mapping and Meta helpers ===== */
function mapRow(r) {
  return {
    id: r.NotificationID ?? r.id ?? r.notificationid,
    message: r.Message ?? r.message,
    is_read: r.IsRead ?? r.is_read ?? false,
    created_at: r.CreatedAt ?? r.created_at,
    sender_name: r.SenderName ?? r.sender_name,
    sender_email: r.SenderEmail ?? r.sender_email,
    sender_role: r.SenderRole ?? r.sender_role,
    receiver_name: r.ReceiverName ?? r.receiver_name,
    receiver_email: r.ReceiverEmail ?? r.receiver_email,
    receiver_role: r.ReceiverRole ?? r.receiver_role,
    created_by: r.CreatedBy ?? r.created_by,
    receiver_id: r.ReceiverID ?? r.receiver_id,
    entity: r.Entity ?? r.entity,
    entity_id: r.EntityId ?? r.entity_id,
    data: r.Data ?? r.data ?? null,
    type: r.Type ?? r.type,
    title: r.Title ?? r.title ?? null,
    enrichedMeta: null,
  };
}

function pickArr(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") return v.split(/[,|\n]/g).map(s => s.trim()).filter(Boolean);
  return [];
}
function defaultTitleFor(n) {
  const ent = String(n?.entity || "").toLowerCase();
  const typ = String(n?.type || "").toLowerCase();
  if (ent.includes("committeerequest") || typ === "request") return "Scheduler committee data request";
  return "New request";
}
function pickMeta(n) {
  const d = n.data || {};
  const m = n.enrichedMeta || {};
  const resolvedTitle = (d.title ?? n.title ?? m.title) || defaultTitleFor(n);
  return {
    title: resolvedTitle,
    level: d.level ?? d.Level ?? m.level ?? null,
    neededFields: pickArr(d.neededFields ?? d.NeededFields ?? m.neededFields),
    description: d.description ?? d.Description ?? m.description ?? null,
    note: d.note ?? d.notes ?? m.note ?? null,
  };
}
function composeShortLine(n) {
  const meta = pickMeta(n);
  return `${meta.title}${meta.level ? ` (Level ${meta.level})` : ""}`;
}
function composeFullMessage(n) {
  const meta = pickMeta(n);
  const lines = [];
  lines.push(`${meta.title}${meta.level ? ` (Level ${meta.level})` : ""}`);
  if (meta.neededFields.length) lines.push(`Required fields: ${meta.neededFields.join(", ")}`);
  if (meta.description) lines.push(String(meta.description));
  if (meta.note) lines.push(String(meta.note));
  return lines.join("\n");
}

/* ===== Theme ===== */
const PAGE_CSS = `
:root {
  --brand-500:#1766ff;
  --brand-600:#0d52d6;
  --brand-700:#0a3ea7;
  --brand-50:#ecf3ff;
}
.page-bg {
  background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
  min-height: 100vh;
  padding-top: 2rem;
}
.card {
  border: 0;
  border-radius: 1rem;
  box-shadow: 0 8px 20px rgba(13,82,214,0.08);
}
.btn-outline-primary {
  border-color: var(--brand-600);
  color: var(--brand-600);
}
.btn-outline-primary:hover {
  background: var(--brand-600);
  color: #fff;
}
.badge.bg-primary {
  background: var(--brand-600)!important;
}
.badge.bg-secondary {
  background: #e9edff!important;
  color: var(--brand-700);
}
.list-group-item:hover {
  background: #f4f8ff;
}
.modal-content {
  border-radius: 1rem;
  box-shadow: 0 12px 28px rgba(7,42,119,0.2);
}
.modal-header {
  background: linear-gradient(90deg,var(--brand-600),var(--brand-700));
  color:#fff;
  border-top-left-radius:1rem;
  border-top-right-radius:1rem;
}
.modal-body {
  background: #fff;
}
.alert-danger {
  background: #fff2f2;
  border: 1px solid #ffd5d5;
}
`;

/* ===== Component ===== */
export default function RegistrarNotifications() {
  const baseAuth = getAuth();
  const [registrarId, setRegistrarId] = useState(baseAuth.registrarId);
  const token = baseAuth.token;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selected, setSelected] = useState(null);

  const auth = useMemo(() => (token ? { headers: { Authorization: `Bearer ${token}` } } : {}), [token]);

  const tryWhoAmI = useCallback(async () => {
    if (registrarId || !token) return;
    const candidates = ["/auth/me", "/Users/me", "/me"];
    for (const path of candidates) {
      try {
        const res = await axios.get(`${API_BASE}${path}`, auth);
        const id = toInt(res.data?.UserID ?? res.data?.userId ?? res.data?.id ?? res.data?.data?.user?.id);
        if (id) { setRegistrarId(id); return; }
      } catch {}
    }
  }, [registrarId, token]);

  const load = useCallback(async () => {
    if (!registrarId) {
      setLoading(false);
      setErr("Missing registrarId in storage.");
      tryWhoAmI();
      return;
    }
    try {
      setLoading(true);
      setErr("");
      const url = `/Notifications/view?receiverId=${registrarId}&limit=30${onlyUnread ? "&isRead=false" : ""}`;
      const res = await API.get(url, auth);
      if (res.data?.success) setList((res.data.notifications || []).map(mapRow));
      else { setList([]); setErr(`Bad API shape: ${JSON.stringify(res.data)}`); }
    } catch (e) {
      setErr(e.message || "Failed to load notifications.");
      setList([]);
    } finally { setLoading(false); }
  }, [registrarId, token, onlyUnread]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await API.post(`/Notifications/mark-read`, { ids: [id] }, auth);
      setList(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) { setErr("Failed to mark as read."); }
  };

  const markAllRead = async () => {
    try {
      if (!registrarId) return;
      await API.post(`/Notifications/mark-all-read`, { receiverId: registrarId }, auth);
      setList(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { setErr("Failed to mark all read."); }
  };

  const enrichIfNeeded = useCallback(async (n) => {
    const isCR = n.entity === "CommitteeRequest" || n.entity === "CommitteeRequests";
    if (!isCR || !n.entity_id) return n;
    try {
      const res = await API.get(`/registrarRequests/requests/${n.entity_id}`, auth);
      const head = res.data || {};
      return {
        ...n,
        enrichedMeta: {
          title: head.title ?? null,
          level: head.level ?? null,
          neededFields: Array.isArray(head.neededFields)
            ? head.neededFields
            : (typeof head.neededFields === "string"
                ? head.neededFields.split(/[,|\n]/g).map(s=>s.trim()).filter(Boolean)
                : []),
          description: head.description ?? null,
        }
      };
    } catch { return n; }
  }, [auth]);

  const openModal = async (n) => {
    if (!n.is_read) await markRead(n.id);
    const enriched = await enrichIfNeeded(n);
    setSelected(enriched);
  };
  const closeModal = () => setSelected(null);

  const unreadCount = list.filter(n => !n.is_read).length;
  const visible = list.filter(n => onlyUnread ? !n.is_read : true);
  const fmt = (d) => (d ? new Date(d).toLocaleString() : "");

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="page-bg">
        <div className="container py-2">

  {/* Hero with soft side space like AddIrregularStudent */}
  <div
    className="hero card text-white mb-5"
    style={{
      background: "linear-gradient(135deg, var(--brand-600), var(--brand-700))",
      boxShadow: "0 12px 32px rgba(23,102,255,.4)",
      borderRadius: "1.25rem",
      padding: "3.5rem 2.5rem",
      marginInline: "auto",     // keeps centered
    }}
  >
            <h1 className="fw-bold mb-3 display-6">Notifications</h1>
            <p className="fs-5 mb-0" style={{ opacity: 0.95 }}>
              Stay updated with your latest system alerts and requests.
            </p>
          </div>

          {/* Inbox */}
          <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center bg-white">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-semibold text-primary">Inbox</span>
                <div className="form-check form-switch m-0">
                  <input className="form-check-input" type="checkbox" id="onlyUnread"
                    checked={onlyUnread}
                    onChange={e => setOnlyUnread(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="onlyUnread">Unread only</label>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-secondary">Unread: {unreadCount}</span>
                <button className="btn btn-outline-secondary btn-sm" onClick={load}>⟳ Refresh</button>
                <button className="btn btn-outline-primary btn-sm" onClick={markAllRead} disabled={!unreadCount}>✓ Mark all read</button>
              </div>
            </div>

            <ul className="list-group list-group-flush">
              {loading && <li className="list-group-item text-muted">Loading…</li>}
              {!!err && !loading && (
                <li className="list-group-item">
                  <div className="alert alert-danger mb-0" style={{ whiteSpace: "pre-wrap" }}>{err}</div>
                </li>
              )}
              {!loading && !err && visible.length === 0 && (
                <li className="list-group-item text-muted">No notifications found.</li>
              )}
              {!loading && !err && visible.map((n) => (
                <li
                  key={n.id}
                  className={`list-group-item d-flex justify-content-between align-items-start ${!n.is_read ? "bg-light" : ""}`}
                  onClick={() => openModal(n)}
                  style={{ cursor: "pointer" }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="fw-semibold">{composeShortLine(n)}</div>
                    <small className="text-muted">{fmt(n.created_at)} {n.entity ? `• ${n.entity}` : ""}</small>
                  </div>
                  {!n.is_read && <span className="badge bg-primary rounded-pill">New</span>}
                </li>
              ))}
            </ul>
             </div>
           </div>
           </div>

          {/* ===== Modal ===== */}
          {selected && (
          <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,.5)" }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
          onKeyDown={(e) => e.key === "Escape" && closeModal()}
         >
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <div className="fw-bold">{selected.receiver_name || "Receiver"}</div>
                  <small>{fmt(selected.created_at)}</small>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {!selected.is_read && <span className="badge bg-light text-dark">New</span>}
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeModal}></button>
                </div>
              </div>

              <div className="modal-body">
                {(() => {
                  const meta = pickMeta(selected);
                  return meta.neededFields.length ? (
                    <div className="mb-3 d-flex flex-wrap gap-2">
                      {meta.neededFields.map((f, i) => (
                        <span key={i} className="badge rounded-pill bg-secondary-subtle text-dark border">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
                <div className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {composeFullMessage(selected)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
