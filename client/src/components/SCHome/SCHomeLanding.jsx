// client/src/pages/Student/HomeLanding.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer"; // ✅ تمّت الإضافة

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

/* ===== عميل HTTP موحّد ===== */
// نفضّل API المشترك إن وُجد. وإلا ننشئ axios مع حقن التوكِن تلقائيًا.
const fallback = axios.create({ baseURL: API_BASE });
fallback.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const http = API || fallback;

/* ===== تخمين الاسم/المستوى من التخزين المحلي كما هي ===== */
function coerceLevelFlexible(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  const direct = Number(s);
  if (Number.isFinite(direct)) {
    const d = Math.trunc(direct);
    if (d >= 1 && d <= 8) return d;
  }
  const m = s.match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) {
      const i = Math.trunc(n);
      if (i >= 1 && i <= 8) return i;
    }
  }
  return null;
}
function readJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function pickUserAndLevelFromStorage() {
  const keys = ["user", "profile", "account", "student"];
  const sources = [];
  for (const k of keys) sources.push({ key: `localStorage.${k}`, obj: readJSON(localStorage.getItem(k)) });
  const loneLevel = localStorage.getItem("level");
  for (const k of keys) sources.push({ key: `sessionStorage.${k}`, obj: readJSON(sessionStorage.getItem(k)) });

  let name = "Student";
  for (const src of sources) {
    const u = src.obj;
    if (!u) continue;
    const full = u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
    if (full) { name = String(full).trim().split(/\s+/)[0]; break; }
  }

  const levelPaths = [(u)=>u?.level,(u)=>u?.student?.level,(u)=>u?.meta?.level,(u)=>u?.settings?.level,(u)=>u?.Student?.level];
  let level = null;
  for (const src of sources) {
    const u = src.obj;
    if (!u) continue;
    for (const get of levelPaths) {
      const v = coerceLevelFlexible(get(u));
      if (v !== null) { level = v; break; }
    }
    if (level !== null) break;
  }
  if (level === null) {
    const v = coerceLevelFlexible(loneLevel);
    if (v !== null) level = v;
  }
  return { name, level };
}

function toNiceText(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(toNiceText).join(", ");
  if (typeof v === "object") {
    const pairs = Object.entries(v).map(([k,val]) => `${k}: ${toNiceText(val)}`);
    return pairs.join(" | ");
  }
  return String(v);
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

/* ===== لوحة الإشعارات ===== */
function StudentNotificationsPanel() {
  const [items, setItems] = React.useState([]);
  const [onlyUnread, setOnlyUnread] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState("respond_request"); // تركيز على Respond request
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [expanded, setExpanded] = React.useState(() => new Set());

  const unreadCount = React.useMemo(() => items.filter((n) => !n.IsRead).length, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((n) => {
      if (onlyUnread && n.IsRead) return false;
      if (typeFilter !== "all" && n.Type !== typeFilter) return false;
      return true;
    });
  }, [items, onlyUnread, typeFilter]);

  async function fetchData() {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      if (onlyUnread) params.unread = 1;
      if (typeFilter !== "all") params.type = typeFilter;

      // ✅ استخدام http الموحّد + تمرير التوكِن تلقائيًا من الـ interceptor
      const res = await http.get(`/api/notifications/sc`, { params });
      setItems(res.data || []);
    } catch (e) {
      console.error(e);
      setErr("Failed to fetch notifications.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { fetchData(); }, []);
  React.useEffect(() => { fetchData(); }, [typeFilter, onlyUnread]);

  async function markRead(id, isRead = true) {
    try {
      await http.put(`/api/notifications/${id}/read`, { isRead });
      setItems((prev) =>
        prev.map((n) =>
          n.NotificationID === id
            ? { ...n, IsRead: isRead, ReadAt: isRead ? new Date().toISOString() : null }
            : n
        )
      );
    } catch (e) {
      console.error(e);
      alert("Failed to update read state.");
    }
  }

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-bell-fill"></i>
          <span className="fw-bold">Notifications</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-white-50">Unread</span>
          <span className={`badge ${unreadCount > 0 ? "bg-danger" : "bg-secondary"}`}>{unreadCount}</span>
        </div>
      </div>

      <div className="card-body">
        {/* فلاتر */}
        <div className="row g-2 align-items-center mb-3">
          <div className="col-12 col-md-auto">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="onlyUnreadSwitch"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="onlyUnreadSwitch">
                Unread only
              </label>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-md-4 col-lg-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All types</option>
              <option value="schedule_feedback_student">Schedule feedback (student)</option>
              <option value="tlc_schedule_feedback">Schedule feedback (TLC)</option>
              <option value="register_to_scheduler">Elective Offer</option>
              <option value="respond_request">Respond request</option>
            </select>
          </div>

          <div className="col-12 col-sm-auto d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={fetchData}>
              Refresh
            </button>
          </div>
        </div>

        {/* حالة تحميل/خطأ/فارغ */}
        {loading && (
          <div className="d-flex align-items-center gap-2 text-muted mb-3">
            <div className="spinner-border spinner-border-sm" role="status" />
            <span>Loading…</span>
          </div>
        )}
        {err && <div className="alert alert-danger">{err}</div>}
        {!loading && filtered.length === 0 && (
          <div className="alert alert-warning mb-0">No notifications.</div>
        )}

        {/* قائمة الإشعارات */}
        <div className="list-group">
          {filtered.map((n) => {
            const isRespond = n.Type === "respond_request";
            const isOpen = expanded.has(n.NotificationID);

            // تفاصيل من Data
            const dataObj =
              typeof n.Data === "string" ? safeParse(n.Data) :
              (n.Data && typeof n.Data === "object" ? n.Data : null);

            // الشارة تعتمد على Message
            const statusBadge =
              n.Message === "approved" ? (
                <span className="badge bg-success">Approved</span>
              ) : n.Message === "rejected" ? (
                <span className="badge bg-danger">Rejected</span>
              ) : null;

            const rows = dataObj
              ? [
                  ["request #", dataObj.requestId ?? "—"],
                  ["level", dataObj.level ?? "N/A"],
                  ["students", Array.isArray(dataObj.students) ? dataObj.students.join(", ") : "N/A"],
                  ["total", dataObj.total ?? "—"],
                  ["status", dataObj.status ?? "—"],
                  ["notes", Array.isArray(dataObj.notes) && dataObj.notes.length ? dataObj.notes.join(" | ") : "—"],
                ]
              : null;

            return (
              <div key={n.NotificationID} className="list-group-item">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="me-3">
                    <div className="d-flex align-items-center gap-2">
                      <strong>{n.TitleDisplay || "Notification"}</strong>
                      {statusBadge}
                      {!n.IsRead && <span className="badge bg-primary">New</span>}
                    </div>

                    {/* لا نعرض From/Email/Schedule إذا كان Respond Request */}
                    {!isRespond && (
                      <>
                        <div className="text-muted small mt-1">
                          From: {n.Full_name || n.CreatedByName || "Unknown"}
                          {n.Email && <div>{n.Email}</div>}
                        </div>
                        {(n.ScheduleLevel != null || n.GroupNo != null) && (
                          <div className="text-muted small">
                            Schedule: {n.ScheduleLevel != null ? `L${n.ScheduleLevel}` : "—"}
                            {(n.ScheduleLevel != null && n.GroupNo != null) ? " • " : " "}
                            {n.GroupNo != null ? `Group ${n.GroupNo}` : ""}
                          </div>
                        )}
                      </>
                    )}

                    {/* الرسالة */}
                    {n.Message && (
                      <div className="text-body mt-1" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                        {isRespond
                          ? (<>{n.Message} — <span className="text-muted">Select "View more" to see details</span></>)
                          : n.Message}
                      </div>
                    )}

                    <small className="text-muted d-block mt-1">
                      {n.CreatedAt ? new Date(n.CreatedAt).toLocaleString() : ""}
                    </small>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {n.IsRead ? (
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => markRead(n.NotificationID, false)}
                      >
                        Mark as unread
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => markRead(n.NotificationID, true)}
                      >
                        Mark as read
                      </button>
                    )}

                    {/* زر View more فقط للـ respond_request */}
                    {isRespond && dataObj && (
                      <button
                        className="btn btn-sm btn-outline-dark"
                        onClick={() => toggleExpand(n.NotificationID)}
                      >
                        {isOpen ? "Hide" : "View more"}
                      </button>
                    )}
                  </div>
                </div>

                {/* تفاصيل respond_request: جدول من Data */}
                {isRespond && isOpen && dataObj && (
                  <div className="mt-3 p-3 border rounded bg-light">
                    <div className="mb-2 fw-semibold">Response Data</div>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <tbody>
                          {rows?.map(([k,v]) => (
                            <tr key={k}>
                              <th style={{width: "180px"}} className="text-muted">{k}</th>
                              <td>{toNiceText(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== الصفحة الرئيسية للطالب ===== */
export default function HomeLanding() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = React.useState("Student");

  const recompute = React.useCallback(() => {
    const { name } = pickUserAndLevelFromStorage();
    setStudentName(name);
  }, []);

  React.useEffect(() => {
    recompute();
    const onStorage = (e) => {
      if (!e || ["user", "profile", "account", "student", "level"].includes(e.key)) recompute();
    };
    const onFocus = () => recompute();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    const id = setInterval(recompute, 2500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, [recompute]);

  return (
    <div className="student-home">
      <section className="hero d-flex align-items-center text-center text-white">
        <div className="container">
          <h1 className="fw-bold mb-3">Welcome {studentName}</h1>
        </div>
      </section>

      <section className="container my-5">
        <StudentNotificationsPanel />
      </section>

      <style>{`
        .student-home { background: #f8fbff; min-height: 100vh; }
        .hero { background: linear-gradient(135deg, #1766ff, #0a3ea7); padding: 80px 20px; }
      `}</style>
    </div>
  );
}
