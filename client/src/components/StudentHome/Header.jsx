import React from "react";
import { NavLink, Link, useInRouterContext } from "react-router-dom";

function useInitials(userName, email, fallback = "ST") {
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
  userName = "Student User",
  email = "student@example.com",
  avatarUrl = "/avatar.png",
}) {
  const inRouter = useInRouterContext();
  const [avatarErr, setAvatarErr] = React.useState(false);
  const initials = useInitials(userName, email, "ST");

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
          data-bs-target="#navbarNavStudent"
          aria-controls="navbarNavStudent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navbarNavStudent">
          <div className="navbar-nav me-auto">
            <LinkEl to="/">Home</LinkEl>
         <LinkEl to="/schedule">Schedule</LinkEl>

            <LinkEl to="/personalized">Personalized Schedule</LinkEl>
           <LinkEl to="/electives">Electives</LinkEl>
          </div>

          <div className="dropdown">
            <button
              className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle"
              type="button"
              id="userMenuStudent"
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

            <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="userMenuStudent">
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
