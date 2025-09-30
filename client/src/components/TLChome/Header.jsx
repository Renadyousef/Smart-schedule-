// components/TLChome/Header.jsx
import React from "react";
import {
  NavLink,
  useNavigate,
  useInRouterContext,
} from "react-router-dom";

function SafeLink({ to, children, className }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <NavLink className={className} to={to}>
        {children}
      </NavLink>
    );
  }
  // خارج الراوتر: استخدم <a>
  return (
    <a className={typeof className === "function" ? "nav-link" : className} href={to}>
      {children}
    </a>
  );
}

export default function Header({ onLogout = () => {} }) {
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : null;
  const [avatarErr, setAvatarErr] = React.useState(false);

  const goProfile = () => {
    if (inRouter && navigate) navigate("/account");
    else window.location.href = "/account"; // fallback خارج الراوتر
  };

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container-fluid">
        <SafeLink className="navbar-brand" to="/">
          <img src="/Logo.png" alt="Logo" height="70" />
        </SafeLink>

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
            <SafeLink
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              to="/"
            >
              Home
            </SafeLink>

            <SafeLink
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
              to="/schedules"
            >
              Schedules
            </SafeLink>
          </div>

          {/* Profile dropdown */}
          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuBtn"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {!avatarErr ? (
                <img
                  src="/avatar.png"
                  alt="Profile"
                  width="32"
                  height="32"
                  className="rounded-circle border"
                  onError={() => setAvatarErr(true)}
                />
              ) : (
                <span
                  className="rounded-circle bg-secondary text-white fw-semibold d-inline-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32, fontSize: 12 }}
                >
                  TLC
                </span>
              )}
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
