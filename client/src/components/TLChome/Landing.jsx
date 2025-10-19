// client/src/components/TLChome/Landing.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ---------- helpers ---------- */
function safeParseJSON(s) {
  if (!s) return null;
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return null; }
}
function toInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; }
function fmtDate(d) { return d ? new Date(d).toLocaleString() : ""; }
function pickArr(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") return v.split(/[,|\n]/g).map(s => s.trim()).filter(Boolean);
  return [];
}

// Pick a friendly first name from local/session storage (like Student HomeLanding)
function pickDisplayNameFromStorage() {
  const keys = ["user", "profile", "account", "tlc", "instructor"];
  const sources = [localStorage, sessionStorage];
  for (const store of sources) {
    for (const k of keys) {
      const obj = safeParseJSON(store.getItem(k));
      if (!obj) continue;
      const userLike = obj.user || obj.profile || obj.account || obj;
      const full = userLike?.name || [userLike?.firstName, userLike?.lastName].filter(Boolean).join(" ").trim();
      if (full && String(full).trim()) {
        return String(full).trim().split(/\s+/)[0];
      }
    }
  }
  return "User";
}

// يستخرج UserID من localStorage أو من JWT
function resolveCurrentUserId(token) {
  // 1) من localStorage: user كـ JSON
  try {
    const u = safeParseJSON(localStorage.getItem("user")) || safeParseJSON(sessionStorage.getItem("user"));
    const idFromObj = toInt(u?.UserID ?? u?.userId ?? u?.id);
    if (idFromObj) return idFromObj;
  } catch {}

  // 2) من مفاتيح منفصلة
  const idKey = toInt(localStorage.getItem("UserID") ?? sessionStorage.getItem("UserID"));
  if (idKey) return idKey;

  // 3) من الـJWT (claims: UserID | userId | sub)
  if (token && token.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const cand = payload?.UserID ?? payload?.userId ?? payload?.sub;
      const idFromJwt = toInt(cand);
      if (idFromJwt) return idFromJwt;
    } catch {}
  }
  return null;
}

function mapRow(r) {
  const data = safeParseJSON(r.Data ?? r.data) ?? {};
  return {
    id: r.NotificationID ?? r.id ?? r.notificationid,
    is_read: r.IsRead ?? r.is_read ?? false,
    created_at: r.CreatedAt ?? r.created_at ?? null,
    type: r.Type ?? r.type ?? "TLC",
    message: r.Message ?? r.message ?? "",
    entity: r.Entity ?? r.entity ?? null,
    entity_id: r.EntityId ?? r.entity_id ?? null,
    data, // parsed subspace/front/action/scheduleId/level/groupNo...
  };
}

/* ---------- title & message composers ---------- */
function defaultTitleFor(n) {
  const t = String(n?.type || "").toLowerCase();
  if (t.startsWith("tlc.schedule")) return "Schedule update";
  return "TLC notification";
}

function pickMeta(n) {
  const d = n.data || {};
  const resolvedTitle = (d.title ?? defaultTitleFor(n));
  return {
    title: resolvedTitle,
    level: d.level ?? d.Level ?? null,
    neededFields: pickArr(d.neededFields ?? d.NeededFields),
    description: d.description ?? d.Description ?? null,
    note: d.note ?? d.notes ?? null,
    action: d.action ?? null,
    front: d.front ?? null,
    subspace: d.subspace ?? null,
    scheduleId: toInt(d.scheduleId ?? d.ScheduleID),
    groupNo: toInt(d.groupNo ?? d.GroupNo),
  };
}

function composeShortLine(n) {
  const m = pickMeta(n);
  const bits = [m.title];
  if (m.level != null) bits.push(`Level ${m.level}`);
  if (m.action) bits.push(m.action.replace(/_/g, " "));
  if (m.scheduleId) bits.push(`#${m.scheduleId}`);
  return bits.join(" • ");
}

function composeFullMessage(n) {
  const m = pickMeta(n);
  const lines = [];
  const head = [m.title];
  if (m.level != null) head.push(`Level ${m.level}`);
  if (m.groupNo != null) head.push(`Group ${m.groupNo}`);
  if (m.scheduleId) head.push(`Schedule #${m.scheduleId}`);
  if (m.front) head.push(`front: ${m.front}`);
  if (m.subspace) head.push(`space: ${m.subspace}`);
  lines.push(head.join(" • "));

  if (m.neededFields.length) lines.push(`Required fields: ${m.neededFields.join(", ")}`);
  if (m.description) lines.push(String(m.description));
  if (m.note) lines.push(String(m.note));
  if (n.message) lines.push(String(n.message));

  return lines.join("\n");
}

/* ---------- component ---------- */
export default function Landing() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";
  const currentUserId = useMemo(() => resolveCurrentUserId(token), [token]);

  const auth = useMemo(() => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (currentUserId) headers["x-user-id"] = String(currentUserId); // المهم: نرسل هوية المستخدم
    return { headers };
  }, [token, currentUserId]);

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [unread, setUnread] = useState(0);
  const [displayName, setDisplayName] = useState("User");

  // Keep a friendly name in sync with storage changes
  useEffect(() => {
    const compute = () => setDisplayName(pickDisplayNameFromStorage());
    compute();
    const onStorage = (e) => {
      if (!e || ["user","profile","account","tlc","instructor"].includes(e.key)) compute();
    };
    const onFocus = () => compute();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    const id = setInterval(compute, 2500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);

  const fetchUnread = useCallback(async () => {
    if (!currentUserId) { setUnread(0); return; }
    try {
      const r = await API.get(`/NotificationsSC/tlc/unread-count`, auth);
      setUnread(Number(r.data?.unread ?? 0));
    } catch {
      setUnread(0);
    }
  }, [auth, currentUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      if (!currentUserId) {
        setErr("Missing user id (x-user-id). Please sign in again.");
        setList([]);
      } else {
        const r = await API.get(
          `/NotificationsSC/tlc`,
          { ...auth, params: { limit: 30, offset: 0, unreadOnly: onlyUnread } }
        );
        if (r.data?.success) {
          const rows = (r.data.notifications || []).map(mapRow);
          setList(rows);
        } else {
          setList([]);
          setErr(`Bad API shape: ${JSON.stringify(r.data)}`);
        }
      }
    } catch (e) {
      const detail = e.response
        ? `HTTP ${e.response.status} ${e.response.statusText} | ${e.config?.method?.toUpperCase()} ${e.config?.url}\n${JSON.stringify(e.response.data)}`
        : e.request
          ? `Network error (no response) | ${e.config?.method?.toUpperCase()} ${e.config?.url}`
          : e.message;
      setErr(detail);
      setList([]);
    } finally {
      setLoading(false);
      await fetchUnread();
    }
  }, [auth, currentUserId, onlyUnread, fetchUnread]);

  useEffect(() => { load(); }, [load]);

  const visible = list; // السيرفر صار يفلتر بـ unreadOnly، فما نعيد فلترة هنا
  const toggleSelect = (id) => {
    const copy = new Set(selectedIds);
    if (copy.has(id)) copy.delete(id); else copy.add(id);
    setSelectedIds(copy);
  };

  const markSelectedRead = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !currentUserId) return;
    try {
      await API.post(`/NotificationsSC/mark-read`, { ids }, auth);
      setList((prev) => prev.map((n) => (selectedIds.has(n.id) ? { ...n, is_read: true } : n)));
      setSelectedIds(new Set());
      await fetchUnread();
    } catch {
      setErr("Failed to mark selected as read.");
    }
  };

  const clearAll = async () => {
    if (!currentUserId) return;
    try {
      await API.post(`/NotificationsSC/clear-all`, {}, auth);
      setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setSelectedIds(new Set());
      await fetchUnread();
    } catch {
      setErr("Failed to clear all.");
    }
  };

  const openModal = (n) => setSelected(n);
  const closeModal = () => setSelected(null);

  return (
    <div className="tlc-home">
      <section className="hero d-flex align-items-center text-center text-white"> 
        <div className="container"> 
          <h1 className="fw-bold mb-3">Welcome {displayName}</h1>
        </div>
      </section>
      <div className="container my-5" style={{ maxWidth: 820 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="m-0 fw-bold">Notification</h1>
        <div className="d-flex align-items-center gap-2">
          <span className="badge text-bg-primary">Unread: {unread}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={load}>⟳ Refresh</button>
          <button
            className="btn btn-outline-success btn-sm"
            onClick={markSelectedRead}
            disabled={selectedIds.size === 0}
            title="Mark selected as read"
          >
            ✓ Mark selected
          </button>
          <button className="btn btn-outline-danger btn-sm" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold">Notifications</span>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="onlyUnread"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />
              <label className="form-check-label small" htmlFor="onlyUnread">
                Unread only
              </label>
            </div>
          </div>
          <span className="badge bg-secondary">Shown: {visible.length}</span>
        </div>

        <ul className="list-group list-group-flush">
          {loading && <li className="list-group-item text-muted">Loading…</li>}
          {!!err && !loading && (
            <li className="list-group-item">
              <div className="alert alert-danger mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {err}
              </div>
            </li>
          )}
          {!loading && !err && visible.length === 0 && (
            <li className="list-group-item text-muted">No notifications.</li>
          )}

          {!loading &&
            !err &&
            visible.map((n) => {
              const meta = pickMeta(n);
              const badgeClass =
                (meta.action === "schedule_shared" && "text-bg-primary") ||
                (meta.action === "schedule_approved" && "text-bg-success") ||
                "text-bg-secondary";
              return (
                <li
                  key={n.id}
                  className={`list-group-item d-flex align-items-start ${!n.is_read ? "bg-light" : ""}`}
                  style={{ cursor: "pointer" }}
                >
                  <div className="form-check me-2 mt-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selectedIds.has(n.id)}
                      onChange={() => toggleSelect(n.id)}
                    />
                  </div>

                  <div className="flex-grow-1" onClick={() => openModal(n)}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className={`badge ${badgeClass}`}>{n.type}</span>
                      {meta.front && <span className="badge text-bg-light">front: {meta.front}</span>}
                      {meta.subspace && <span className="badge text-bg-light">space: {meta.subspace}</span>}
                      {meta.level != null && <span className="badge text-bg-info">L{meta.level}</span>}
                      {meta.groupNo != null && <span className="badge text-bg-info">G{meta.groupNo}</span>}
                      {meta.scheduleId != null && <span className="badge text-bg-dark">#{meta.scheduleId}</span>}
                      {!n.is_read && <span className="badge text-bg-danger">Unread</span>}
                      <small className="text-muted ms-auto">{fmtDate(n.created_at)}</small>
                    </div>

                    <div className="mt-2 fw-semibold">{composeShortLine(n)}</div>
                    {n.message && (
                      <div className="text-muted small mt-1" style={{ whiteSpace: "pre-wrap" }}>
                        {n.message}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
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
          onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <div className="fw-bold">TLC Notification</div>
                <div className="d-flex align-items-center gap-2">
                  {!selected.is_read && <span className="badge bg-primary">New</span>}
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeModal}></button>
                </div>
              </div>
              <div className="modal-body">
                <div className="mb-3" style={{ whiteSpace: "pre-wrap" }}>
                  {composeFullMessage(selected)}
                </div>

                {/* data dump for transparency */}
                <details>
                  <summary className="small text-muted">Details (Data)</summary>
                  <pre className="bg-light p-2 rounded small">
                    {JSON.stringify(selected.data, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
      <style>{`
        .tlc-home { background: #f8fbff; min-height: 100vh; }
        .hero { background: linear-gradient(135deg, #1766ff, #0a3ea7); padding: 80px 20px; }
      `}</style>
    </div>
  );
}
