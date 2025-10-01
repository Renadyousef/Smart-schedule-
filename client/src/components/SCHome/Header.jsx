import React from "react";
import { NavLink, Link, useInRouterContext } from "react-router-dom";

function useInitials(userName, email, fallback = "SC") {
  return React.useMemo(() => {
    const src =
      (userName && userName.trim()) ||
      (email ? email.split("@")[0].replace(/[._-]+/g, " ").trim() : "");
    if (!src) return fallback;
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts.at(-1)[0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }, [userName, email, fallback]);
}

export default function Header({
  onLogout = () => {},
  userName = "SC Member",
  email = "sc@example.com",
  avatarUrl = "/avatar.png",
}) {
  const inRouter = useInRouterContext();
  const [avatarErr, setAvatarErr] = React.useState(false);
  const initials = useInitials(userName, email, "SC");

  const Brand = inRouter ? NavLink : (p) => <a {...p} href="/" />;
  const LinkEl = inRouter
    ? ({ to, children }) => (
        <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to={to}>
          {children}
        </NavLink>
      )
    : ({ to, children }) => (
        <a className="nav-link" href={to}>
          {children}
        </a>
      );

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container-fluid">
        <Brand className="navbar-brand" to="/">
          <img src="/Logo.png" alt="Logo" height="70" />
        </Brand>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNavSC"
          aria-controls="navbarNavSC"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navbarNavSC">
          {/* SC links */}
          <div className="navbar-nav me-auto">
            <NavLink className="nav-link" to="/">Home</NavLink>
                        <NavLink className="nav-link" to="/manage">Manage scheduling rules</NavLink>
                        <NavLink className="nav-link" to="/core">Core courses</NavLink>
                        <NavLink className="nav-link" to="/irregular">Irregular students</NavLink>
            
                        {/* ✅ استبدلي المسار القديم اللي فيه مسافة */}
                        <NavLink className="nav-link" to="/requests">Requests</NavLink>
                        <NavLink className="nav-link" to="/requests/new">Create Request</NavLink>
            
                        <NavLink className="nav-link" to="/start">Start scheduling</NavLink>
          </div>

          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuSC"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              {!avatarErr ? (
                <img
                  src={avatarUrl}
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
                  {initials}
                </span>
              )}
            </button>

            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userMenuSC">
              <li>{inRouter ? <Link className="dropdown-item" to="/account">View Profile</Link> : <a className="dropdown-item" href="/account">View Profile</a>}</li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item text-danger" onClick={onLogout}>Log out</button></li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
