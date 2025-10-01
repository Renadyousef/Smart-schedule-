import React from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";


// استخرج أول رقم 1-8 حتى لو كان داخل نص مثل "Level 3"
function coerceLevelFlexible(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  const direct = Number(s);
  if (Number.isFinite(direct)) {
    const d = Math.trunc(direct);
    if (d >= 1 && d <= 8) return d;
  }
  const m = s.match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) {
      const i = Math.trunc(n);
      if (i >= 1 && i <= 8) return i;
    }
  }
  return null;
}

function readJSON(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

function pickUserAndLevelFromStorage() {
  const keys = ["user", "profile", "account", "student"];
  const sources = [];
  for (const k of keys) {
    sources.push({ key: `localStorage.${k}`, obj: readJSON(localStorage.getItem(k)) });
  }
  const loneLevel = localStorage.getItem("level");
  for (const k of keys) {
    sources.push({ key: `sessionStorage.${k}`, obj: readJSON(sessionStorage.getItem(k)) });
  }

  let name = "Student";
  for (const src of sources) {
    const u = src.obj;
    if (!u) continue;
    const full = u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
    if (full) { name = String(full).trim().split(/\s+/)[0]; break; }
  }

  const levelPaths = [
    (u) => u?.level,
    (u) => u?.student?.level,
    (u) => u?.meta?.level,
    (u) => u?.settings?.level,
    (u) => u?.Student?.level,
  ];

  let level = null;
  for (const src of sources) {
    const u = src.obj;
    if (!u) continue;
    for (const get of levelPaths) {
      const v = coerceLevelFlexible(get(u));
      if (v !== null) { level = v; break; }
    }
    if (level !== null) break;
  }
  if (level === null) {
    const v = coerceLevelFlexible(loneLevel);
    if (v !== null) level = v;
  }

  return { name, level };
}

export default function HomeLanding() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = React.useState("Student");
  const [showPopup, setShowPopup] = React.useState(false);

  const recompute = React.useCallback(() => {
    const { name, level } = pickUserAndLevelFromStorage();
    setStudentName(name);
    setShowPopup(!(level !== null && level >= 1 && level <= 8));
  }, []);

  React.useEffect(() => {
    recompute();
    const onStorage = (e) => {
      if (!e || ["user","profile","account","student","level"].includes(e.key)) recompute();
    };
    const onFocus = () => recompute();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    const id = setInterval(recompute, 2500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, [recompute]);

  return (
    <div className="student-home">
      {/* Hero */}
      <section className="hero d-flex align-items-center text-center text-white">
        <div className="container">
          <h1 className="fw-bold mb-3">Welcome {studentName}</h1>
        </div>
      </section>

      {/* Notifications */}
      <section className="container my-5">
        <div className="card border-0 shadow-sm info-box">
          <div className="card-header bg-primary text-white fw-bold">
            <i className="bi bi-bell-fill me-2"></i> Notifications
          </div>
          <div className="card-body">
            <ul className="list-unstyled mb-0 small">
              <li className="mb-3">
                <div className="fw-semibold">Electives deadline</div>
                <div className="text-muted">Submit by Oct 15</div>
              </li>
              <li className="mb-3">
                <div className="fw-semibold">Profile update</div>
                <div className="text-muted">Remember to check your info</div>
              </li>
              <li>
                <div className="fw-semibold">New feature</div>
                <div className="text-muted">Personalized scheduling is live</div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Popup */}
      {showPopup && (
        <div className="popup-backdrop">
          <div className="popup-card">
            <div className="popup-header">
              <h5 className="m-0">Complete your profile</h5>
              <button className="btn-close" onClick={() => setShowPopup(false)} aria-label="Close" />
            </div>
            <div className="popup-body">
              <p className="mb-2">
                To personalize your schedule, please set your <strong>Level (1–8)</strong>.
              </p>
              <small className="text-muted">You can do this anytime from your profile.</small>
            </div>
            <div className="popup-footer d-flex gap-2 justify-content-end">
            
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowPopup(false);
                  navigate("/account");
                }}
              >
                Complete now
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .student-home { background: #f8fbff; min-height: 100vh; }
        .hero { background: linear-gradient(135deg, #1766ff, #0a3ea7); padding: 80px 20px; }
        .info-box { border-radius: .75rem; }
        .popup-backdrop {
          position: fixed; inset: 0; background: rgba(15, 23, 42, .35);
          display: flex; align-items: center; justify-content: center;
          z-index: 1055; padding: 16px;
        }
        .popup-card {
          width: min(520px, 100%); background: #fff; border-radius: 18px;
          box-shadow: 0 18px 50px rgba(15,23,42,.20); overflow: hidden;
          border: 1px solid rgba(148,163,184,.22);
        }
        .popup-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid rgba(148,163,184,.22);
          background: #f8fafc;
        }
        .popup-body { padding: 14px 16px; }
        .popup-footer { padding: 12px 16px; border-top: 1px solid rgba(148,163,184,.22); }
      `}</style>
    </div>
  );
}
