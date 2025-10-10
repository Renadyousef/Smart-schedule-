import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getAuth() {
  const token = localStorage.getItem("token") || "";
  const uid = Number(localStorage.getItem("userId") || localStorage.getItem("UserID") || 0);
  return { token, registrarId: uid || undefined };
}

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
  };
}

function buildMessage(n) {
  try {
    const d = n.data || {};
    if ((n.type === "request" || n.entity === "CommitteeRequest") && (d.action === "registrar_response" || d.responseType || d.category)) {
      const who = n.sender_name || "Registrar";
      const student = d.studentName || (d.studentId ? `Student ${d.studentId}` : "student");
      const status = (d.lineStatus || d.status || "updated").toString();
      let verb = status;
      if (status === "fulfilled") verb = "completed";
      else if (status === "rejected") verb = "rejected";
      else if (status === "failed") verb = "failed";
      else if (status === "pending") verb = "updated (pending)";
      const ir = String(d.category || d.responseType || "").toLowerCase().includes("irregular");
      const parts = [];
      const courses = d.PreviousLevelCourses || d.courses;
      if (Array.isArray(courses) && courses.length) parts.push(`Courses: ${courses.join(", ")}`);
      if (d.Level || d.level) parts.push(`Level: ${d.Level || d.level}`);
      if (d.replace !== undefined || d.Replace !== undefined) parts.push((d.replace ?? d.Replace) ? "Replaced previous courses" : "Appended to existing courses");
      return `${who} ${verb} ${ir ? "an irregular update for" : "a request for"} ${student}${parts.length ? ` (${parts.join("; ")})` : ""}`;
    }
    if ((n.type === "request" || n.entity === "CommitteeRequest") && (d.action === "request_status")) {
      const who = n.sender_name || "Registrar";
      const s = (d.status || "updated").toString();
      const verb = s === "fulfilled" ? "completed" : s;
      return `${who} ${verb} committee request #${n.entity_id ?? n.id ?? ""}`.trim();
    }
    if (n.type === "feedback") {
      const who = n.sender_name || "Someone";
      const where = n.entity_id ? ` on schedule ${n.entity_id}` : "";
      return `${who} posted feedback${where}`;
    }
  } catch {}
  return n.message || "Notification";
}

export default function RegistrarNotifications() {
  const { token, registrarId } = getAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  const auth = useMemo(() => (token ? { headers: { Authorization: `Bearer ${token}` } } : {}), [token]);

  const load = useCallback(async () => {
    if (!registrarId) { setLoading(false); return; }
    try {
      const url = `${API_BASE}/Notifications/view?receiverId=${registrarId}&limit=30`;
      const res = await axios.get(url, auth);
      if (res.data?.success) setList((res.data.notifications || []).map(mapRow));
      else setList([]);
    } catch (e) {
      console.error("registrar notifications load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [registrarId, token]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await axios.post(`${API_BASE}/Notifications/mark-read`, { ids: [id] }, auth);
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (e) {
      console.error("mark read failed:", e);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (loading) return <div className="m-4">Loading notifications...</div>;
  if (list.length === 0) return <div className="m-4">No notifications.</div>;

  return (
    <div className="container mt-4" style={{ maxWidth: 640 }}>
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Notifications</span>
          <span className="badge bg-danger">{list.filter((n) => !n.is_read).length}</span>
        </div>
        <ul className="list-group list-group-flush">
          {list.map((n) => (
            <li
              key={n.id}
              className={`list-group-item d-flex justify-content-between align-items-start ${!n.is_read ? "bg-light" : ""}`}
              onClick={() => { if (!n.is_read) markRead(n.id); toggleExpand(n.id); }}
              style={{ cursor: "pointer" }}
            >
              <div style={{ flex: 1 }}>
                <div className="fw-semibold">{buildMessage(n)}</div>
                <small className="text-muted">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  {n.entity ? ` • ${n.entity}#${n.entity_id ?? ""}` : ""}
                </small>
                {expanded.has(n.id) && (
                  <div className="mt-2">
                    {(n.sender_name || n.sender_email || n.sender_role) && (
                      <div>
                        <span className="fw-semibold">From:</span> {n.sender_name || "Unknown"}
                        {n.sender_role ? ` (${n.sender_role})` : ""}
                        {n.sender_email ? ` — ${n.sender_email}` : ""}
                      </div>
                    )}
                    {(n.receiver_name || n.receiver_email || n.receiver_role) && (
                      <div>
                        <span className="fw-semibold">To:</span> {n.receiver_name || "Unknown"}
                        {n.receiver_role ? ` (${n.receiver_role})` : ""}
                        {n.receiver_email ? ` — ${n.receiver_email}` : ""}
                      </div>
                    )}
                    {n.data && Object.keys(n.data || {}).length ? (
                      <pre className="mt-2 bg-body-secondary p-2 rounded" style={{ whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(n.data, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
              {!n.is_read && <span className="badge bg-primary rounded-pill">new</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
