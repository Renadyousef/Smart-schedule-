// client/src/components/Layout/Header.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

export default function Header({ onLogout }) {
  const navigate = useNavigate();
  const goProfile = () => navigate("/account");

  const LinkEl = ({ to, children }) => (
    <NavLink
      className={({ isActive }) =>
        "nav-link" +
        (isActive ? " active fw-semibold text-primary" : "")
      }
      to={to}
      end
    >
      {children}
    </NavLink>
  );

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-white border-bottom">
        <div className="container-fluid">

          {/* Logo */}
          <NavLink className="navbar-brand d-flex align-items-center" to="/">
            <img src="/Logo.png" alt="Logo" height="60" />
          </NavLink>

          {/* Mobile Toggle */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon" />
          </button>

          {/* Navbar */}
          <div className="collapse navbar-collapse" id="navbarNav">

            {/* Tabs – ONLY resized, no blue underline */}
            <div className="navbar-nav me-auto nav-tabs-small d-flex flex-wrap align-items-center gap-2">
              <LinkEl to="/">Home</LinkEl>
              <LinkEl to="/external-courses">External Courses</LinkEl>
              <LinkEl to="/internal-courses">Internal Courses</LinkEl>
              <LinkEl to="/generated-schedule">Generated Schedule</LinkEl>
              <LinkEl to="/history">History</LinkEl>
              <LinkEl to="/share-schedule">Share Schedule</LinkEl>
              <LinkEl to="/manage">Manage scheduling rules</LinkEl>
              <LinkEl to="/irregular-student">Irregular Students</LinkEl>
              <LinkEl to="/Electives/handel">Electives</LinkEl>
              <LinkEl to="/dashboard">Dashboard</LinkEl>
            </div>

            {/* User Dropdown */}
            <div className="dropdown">
              <button
                className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle px-3"
                type="button"
                id="userMenuBtn"
                data-bs-toggle="dropdown"
              >
                <img
                  src="/avatar.png"
                  alt="Profile"
                  width="32"
                  height="32"
                  className="rounded-circle border"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fb = document.getElementById("avatar-fallback");
                    if (fb) fb.style.display = "inline-flex";
                  }}
                />

                <span
                  id="avatar-fallback"
                  style={{ display: "none", width: 32, height: 32 }}
                  className="rounded-circle bg-secondary text-white fw-semibold d-inline-flex align-items-center justify-content-center"
                >
                  SC
                </span>
              </button>

              <ul className="dropdown-menu dropdown-menu-end">
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

      {/* تصغير الخط فقط – بدون أي خط تحت */}
      <style>{`
        .nav-tabs-small .nav-link {
          font-size: 14px;
          padding: 6px 10px;
          white-space: nowrap;
        }

        /* منع أي خط تحت */
        .nav-tabs-small .nav-link.active {
          border: none !important;
        }

        .nav-tabs-small .nav-link:hover {
          color: #1766ff;
        }
      `}</style>
    </>
  );
}
