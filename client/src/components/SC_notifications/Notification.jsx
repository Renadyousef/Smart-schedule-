import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Notification() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/Notifications/view?limit=20`, auth);
      if (res.data.success) setList(res.data.notifications);
    } catch (e) {
      console.error("fetch notifications failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await axios.patch(`${API_BASE}/Notifications/${id}/read`, {}, auth);
      setList((prev) => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error("mark read failed:", e);
    }
  };

  if (loading) return <div className="m-4">Loading notifications...</div>;
  if (list.length === 0) return <div className="m-4">No notifications.</div>;

  return (
    <div className="container mt-4" style={{ maxWidth: 640 }}>
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Notifications</span>
          <span className="badge bg-danger">
            {list.filter(n => !n.is_read).length}
          </span>
        </div>
        <ul className="list-group list-group-flush">
          {list.map(n => (
            <li
              key={n.id}
              className={`list-group-item d-flex justify-content-between align-items-start ${!n.is_read ? "bg-light" : ""}`}
              onClick={() => !n.is_read && markRead(n.id)}
              style={{ cursor: !n.is_read ? "pointer" : "default" }}
              title={!n.is_read ? "Mark as read" : ""}
            >
              <div>
                <div className="fw-semibold">{n.message}</div>
                <small className="text-muted">
                  From: {n.sender_type || "Unknown"} ({n.sender_email || "N/A"}) •{" "}
                  {new Date(n.created_at).toLocaleString()}
                  {n.entity ? ` • ${n.entity}#${n.entity_id ?? ""}` : ""}
                </small>
              </div>
              {!n.is_read && <span className="badge bg-primary rounded-pill">new</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
