// RegistrarHeader.jsx
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function initialsFrom(nameLike, fallback = "RG") {
  const s = String(nameLike || "").trim();
  if (!s) return fallback;
  if (s.includes("@")) return s.split("@")[0].slice(0, 2).toUpperCase();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function RegistrarHeader({ onLogout }) {
  const navigate = useNavigate();
  const [showImg, setShowImg] = useState(true);

  const token = useMemo(() => localStorage.getItem("token") || "", []);
  const userId = useMemo(() => Number(localStorage.getItem("userId") || 0), []);
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const displayName = useMemo(
    () =>
      localStorage.getItem("fullName") ||
      localStorage.getItem("userName") ||
      localStorage.getItem("email") ||
      "",
    []
  );
  const initials = useMemo(() => initialsFrom(displayName, "RG"), [displayName]);

  const [unreadCount, setUnreadCount] = useState(0);
  async function loadCounts() {
    if (!userId) return;
    try {
      const url = `${API_BASE}/Notifications/counts?receiverId=${userId}`;
      const res = await axios.get(url, { headers });
      setUnreadCount(Number(res.data?.unread || 0));
    } catch {}
  }
  useEffect(() => {
    loadCounts();
    const id = setInterval(loadCounts, 30000);
    return () => clearInterval(id);
  }, []);

  const goProfile = () => navigate("/account");

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container-fluid">
        <NavLink className="navbar-brand" to="/">
          <img src="/Logo.png" alt="Logo" height="70" />
        </NavLink>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNavAltMarkup"
          aria-controls="navbarNavAltMarkup"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
          <div className="navbar-nav me-auto">
            <NavLink className="nav-link" to="/">Home</NavLink>
            <NavLink className="nav-link" to="/registrar/electives">Offer Electives</NavLink>
            <NavLink className="nav-link" to="/registrar/irregular">Irregular Students</NavLink>
            <NavLink className="nav-link position-relative" to="/registrar/notifications">
              <span className="me-1"></span> Notifications
              {unreadCount > 0 && (
                <span
                  className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                  style={{ fontSize: 10 }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                  <span className="visually-hidden">unread</span>
                </span>
              )}
            </NavLink>
          </div>

          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuBtn"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {showImg ? (
                <img
                  src="/avatar.png"
                  alt="Profile"
                  width="32"
                  height="32"
                  className="rounded-circle border"
                  onError={() => setShowImg(false)}
                />
              ) : (
                <span
                  className="rounded-circle bg-secondary text-white fw-semibold d-inline-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32, fontSize: 12 }}
                >
                  {initials}
                </span>
              )}
              <span className="d-none d-sm-inline">{displayName || "Registrar"}</span>
            </button>

            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userMenuBtn">
              <li>
                <button className="dropdown-item" onClick={goProfile}>
                  View Profile
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button
                  className="dropdown-item text-danger"
                  onClick={onLogout}
                >
                  Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
