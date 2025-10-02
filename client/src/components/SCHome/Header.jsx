import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

export default function Header({ onLogout }) {
  const navigate = useNavigate();
  const goProfile = () => navigate("/account");

  const LinkEl = ({ to, children }) => (
    <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to={to}>
      {children}
    </NavLink>
  );

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
          {/* روابط SC — مطابقة لأسماء الملفات */}
          <div className="navbar-nav me-auto">
            <LinkEl to="/">Home</LinkEl>
            <LinkEl to="/external-courses">External Courses</LinkEl>
            <LinkEl to="/internal-courses">Internal Courses</LinkEl>
            <LinkEl to="/generated-schedule">Generated Schedule</LinkEl>
            <LinkEl to="/share-schedule">Share Schedule</LinkEl>
            <LinkEl to="/manage">Manage scheduling rules</LinkEl>
             <NavLink className="nav-link" to="/requests">Requests</NavLink>
            <NavLink className="nav-link" to="/requests/new">Create Request</NavLink>
                 <NavLink className="nav-link" to="/Electives/handel">Electives</NavLink>
          </div>
       

          {/* منيو المستخدم */}
          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuBtn"
              data-bs-toggle="dropdown"
              aria-expanded="false"
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

            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userMenuBtn">
              <li><button className="dropdown-item" onClick={goProfile}>View Profile</button></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item text-danger" onClick={onLogout}>Log out</button></li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}