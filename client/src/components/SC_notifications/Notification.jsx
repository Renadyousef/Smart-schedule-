import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Notification() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get("http://localhost:5000/Notifications/view"); // only works like this
        if (res.data.success) {
          setNotifications(res.data.notifications);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  if (loading) return <div className="m-4">Loading notifications...</div>;
  if (notifications.length === 0) return <div className="m-4">No notifications available.</div>;

  return (
    <div className="container mt-4" style={{ maxWidth: "600px" }}>
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Notifications</span>
          <span className="badge bg-danger">{notifications.length}</span>
        </div>
        <ul className="list-group list-group-flush">
          {notifications.map((notif) => (
            <li key={notif.notificationid} className="list-group-item">
              <div>{notif.message}</div>
              <small className="text-muted">
                From: {notif.sender_type || "Unknown"} ({notif.sender_email || "N/A"})
              </small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
