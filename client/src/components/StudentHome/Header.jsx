import { NavLink } from "react-router-dom";

export default function Header() {
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
          <div className="navbar-nav">
            <NavLink
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
              to="/"
            >
              Home
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
              to="/"
            >
              Schedulas
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
              to="/"
            >
              Pesonlaized scheudle
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
