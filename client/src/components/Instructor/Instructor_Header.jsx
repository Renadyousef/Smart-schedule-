// src/components/InstructorHome/Instructor_Header.jsx
import { NavLink, useNavigate } from "react-router-dom";

export default function Instructor_Header({ onLogout }) {
  const navigate = useNavigate();

  const goProfile = () => {
    navigate("/account"); // أو "/profile" حسب مسار صفحة البروفايل عندك
  };

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
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
          {/* روابط الـ Instructor */}
          <div className="navbar-nav me-auto">
            <NavLink className="nav-link" to="/">Home</NavLink>
            <NavLink className="nav-link" to="/assigned-courses">
              View Assigned Courses Schedule
            </NavLink>
          </div>

          {/* منيو المستخدم (بروفايل + لوج آوت) */}
          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuBtn"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {/* صورة البروفايل */}
              <img
                src="/avatar.png"
                alt="Profile"
                width="32"
                height="32"
                className="rounded-circle border"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = document.getElementById("avatar-fallback");
                  if (fallback) fallback.style.display = "inline-flex";
                }}
              />
              <span
                id="avatar-fallback"
                style={{ display: "none" }}
                className="rounded-circle bg-secondary text-white fw-semibold d-inline-flex align-items-center justify-content-center"
              >
                <span style={{ width: 32, height: 32, lineHeight: "32px", textAlign: "center", fontSize: 12 }}>
                  IN
                </span>
              </span>
            </button>

            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userMenuBtn">
              <li>
                <button className="dropdown-item" onClick={goProfile}>
                  View Profile
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item text-danger" onClick={onLogout}>
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
