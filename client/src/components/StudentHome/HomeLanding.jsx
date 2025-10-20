// client/src/pages/Student/HomeLanding.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer";

/* ===== Helpers ===== */
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

function readJSON(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function pickUserAndLevelFromStorage() {
  const keys = ["user", "profile", "account", "student"];
  const sources = [];
  for (const k of keys) sources.push({ obj: readJSON(localStorage.getItem(k)) });
  const loneLevel = localStorage.getItem("level");
  for (const k of keys) sources.push({ obj: readJSON(sessionStorage.getItem(k)) });

  let name = "Student";
  for (const src of sources) {
    const u = src.obj;
    if (!u) continue;
    const full =
      u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
    if (full) {
      name = String(full).trim().split(/\s+/)[0];
      break;
    }
  }

  const levelPaths = [
    (u) => u?.level,
    (u) => u?.student?.level,
    (u) => u?.meta?.level,
    (u) => u?.settings?.level,
    (u) => u?.Student?.level,
  ];
  let level = null;
  for (const src of sources) {
    const u = src.obj;
    if (!u) continue;
    for (const get of levelPaths) {
      const v = coerceLevelFlexible(get(u));
      if (v !== null) {
        level = v;
        break;
      }
    }
    if (level !== null) break;
  }
  if (level === null) {
    const v = coerceLevelFlexible(loneLevel);
    if (v !== null) level = v;
  }
  return { name, level };
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString();
  } catch {
    return "";
  }
}

/* ===== ستاتيك داتا (fallback فقط عند فشل API) ===== */
const STATIC_NOTICES = [
  {
    id: "static-1",
    title: "Schedule is available",
    message: "New schedule is available for your level.",
    createdAt: new Date().toISOString(),
    IsRead: false,
    Full_name: null,
    Email: null,
    ScheduleLevel: null,
    GroupNo: null,
  },
  {
    id: "static-2",
    title: "Schedule is available",
    message: "Group list has been updated.",
    createdAt: new Date(Date.now() - 3600e3).toISOString(),
    IsRead: true,
    Full_name: null,
    Email: null,
    ScheduleLevel: null,
    GroupNo: null,
  },
];

/* ===== لوحة الإشعارات ===== */
function StudentNotificationsPanel() {
  const [items, setItems] = React.useState([]);
  const [onlyUnread, setOnlyUnread] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  const unreadCount = React.useMemo(
    () => items.filter((n) => n.IsRead === false).length,
    [items]
  );

  const filtered = React.useMemo(() => {
    return items.filter((n) => (onlyUnread ? n.IsRead === false : true));
  }, [items, onlyUnread]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/api/st-notifications", {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = res?.data;
      const rows = Array.isArray(data?.rows) ? data.rows : [];

      let prepared = rows.map((r) => ({
        NotificationID: r.id ?? r.NotificationID ?? crypto.randomUUID(),
        TitleDisplay: "Schedule is available",
        Message: r.message ?? r.Message ?? "You can now view the schedule.",
        CreatedAt: r.createdAt ?? r.CreatedAt ?? null,
        IsRead: r.IsRead === true,
        ReadAt: r.ReadAt ?? null,
        Full_name: r.Full_name ?? null,
        Email: r.Email ?? null,
        ScheduleLevel: r.ScheduleLevel ?? null,
        GroupNo: r.GroupNo ?? null,
      }));

      if (!prepared.length) {
        prepared = STATIC_NOTICES.map((n) => ({
          NotificationID: n.id,
          TitleDisplay: n.title,
          Message: n.message,
          CreatedAt: n.createdAt,
          IsRead: n.IsRead === true,
          ReadAt: n.ReadAt ?? null,
          Full_name: n.Full_name,
          Email: n.Email,
          ScheduleLevel: n.ScheduleLevel,
          GroupNo: n.GroupNo,
        }));
      }

      prepared.sort(
        (a, b) => new Date(b.CreatedAt ?? 0) - new Date(a.CreatedAt ?? 0)
      );
      setItems(prepared);
    } catch (e) {
      console.error(e);
      setItems(
        STATIC_NOTICES.map((n) => ({
          NotificationID: n.id,
          TitleDisplay: n.title,
          Message: n.message,
          CreatedAt: n.createdAt,
          IsRead: n.IsRead === true,
          ReadAt: n.ReadAt ?? null,
          Full_name: n.Full_name,
          Email: n.Email,
          ScheduleLevel: n.ScheduleLevel,
          GroupNo: n.GroupNo,
        }))
      );
      setErr("Showing static notifications (API not reachable).");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function markRead(id, isRead = true) {
    try {
      await API.put(`/api/notifications/${id}/read`, { isRead });
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to update read state.");
    }
  }

  async function markAllRead() {
    try {
      await API.put("/api/st-notifications/mark-all-read", {});
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to mark all as read.");
    }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-bell-fill"></i>
          <span className="fw-bold">Notifications</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="text-white-50">Unread</span>
          <span
            className={`badge ${
              unreadCount > 0 ? "bg-danger" : "bg-secondary"
            }`}
          >
            {unreadCount}
          </span>
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

          <div className="col-12 col-sm-auto d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={fetchData}>
              Refresh
            </button>
            <button className="btn btn-outline-primary" onClick={markAllRead}>
              Mark all as read
            </button>
          </div>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2 text-muted mb-3">
            <div className="spinner-border spinner-border-sm" role="status" />
            <span>Loading…</span>
          </div>
        )}
        {err && <div className="alert alert-warning">{err}</div>}
        {!loading && filtered.length === 0 && (
          <div className="alert alert-light border text-muted mb-0">
            No notifications.
          </div>
        )}

        <div className="list-group">
          {filtered.map((n) => (
            <div
              key={n.NotificationID}
              className="list-group-item d-flex justify-content-between align-items-start"
            >
              <div className="me-3">
                <div className="d-flex align-items-center gap-2">
                  <strong>{n.TitleDisplay || "Notification"}</strong>
                  {n.IsRead === false && (
                    <span className="badge bg-primary">New</span>
                  )}
                </div>

                <div className="text-muted small mt-1">
                  From: {n.Full_name || "Unknown"}
                  {Number.isFinite(n.ScheduleLevel) && (
                    <span className="ms-2">
                      (Level {n.ScheduleLevel}
                      {typeof n.GroupNo !== "undefined" &&
                      n.GroupNo !== null
                        ? `, Group ${n.GroupNo}`
                        : ""}
                      )
                    </span>
                  )}
                  {n.Email && <div>{n.Email}</div>}
                </div>

                <div className="text-body mt-1">{n.Message}</div>
                <small className="text-muted d-block mt-1">
                  {n.CreatedAt ? formatDate(n.CreatedAt) : ""}
                </small>
              </div>

              <div className="d-flex align-items-center gap-2">
                {n.IsRead === true ? (
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== الصفحة الرئيسية ===== */
export default function HomeLanding() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = React.useState("Student");
  const [showPopup, setShowPopup] = React.useState(false);

  const recompute = React.useCallback(() => {
    const { name, level } = pickUserAndLevelFromStorage();
    setStudentName(name);
    setShowPopup(!(level !== null && level >= 1 && level <= 8));
  }, []);

  React.useEffect(() => {
    recompute();
    const onStorage = (e) => {
      if (!e || ["user", "profile", "account", "student", "level"].includes(e.key))
        recompute();
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

      <section className="container my-3">
        <div className="alert alert-info mb-4" role="alert" style={{ borderRadius: 12 }}>
          <strong>Important Notification: </strong>
          Elective offerings close on <strong>Oct 15</strong>. Please submit before the deadline.
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
