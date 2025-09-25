// Header.jsx
import { NavLink, useNavigate } from "react-router-dom";

export default function Header({ onLogout }) {
  const navigate = useNavigate();

  const goProfile = () => {
    navigate("/account"); // غيّريها إلى /profile إذا اسم صفحتك كذا
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
          <div className="navbar-nav me-auto">
            <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="/">
              Home
            </NavLink>
            <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="/schedules">
              Schedules
            </NavLink>
            <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="/personalized">
              Personalized Schedule
            </NavLink>
          </div>

          {/* User menu (profile icon + dropdown) */}
          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuBtn"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {/* صورة بروفايل أو حروف أولية */}
              <img
                src="/avatar.png"        /* بدّليها بصورة المستخدم إن وُجدت */
                alt="Profile"
                width="32"
                height="32"
                className="rounded-circle border"
                onError={(e) => {
                  // fallback إلى دائرة بحرفين
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
                  ST
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
          {/* /User menu */}
        </div>
      </div>
    </nav>
  );
}
