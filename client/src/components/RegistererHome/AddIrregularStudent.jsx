// client/src/pages/AddIrregularStudent.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Footer from "../Footer/Footer.jsx";
import API from "../../API_continer.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ===== Utilities ===== */
function getUserHeaders() {
  const userId = localStorage.getItem("userId");
  return userId ? { headers: { "X-User-Id": userId } } : {};
}

const COURSE_RE = /^[A-Za-z0-9_-]{1,20}$/;
function normalizeCoursesText(input) {
  const raw = String(input || "")
    .split(/[, \n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    if (!COURSE_RE.test(r)) continue;
    const up = r.toUpperCase();
    if (!seen.has(up)) {
      seen.add(up);
      out.push(up);
    }
  }
  return out;
}

/* ===== Theme (Matches ElectivePreferences) ===== */
const PAGE_CSS = `
:root{
  --brand-500:#1766ff;
  --brand-600:#0d52d6;
  --brand-700:#0a3ea7;
  --brand-50:#ecf3ff;
}
.page-wrap{
  min-height:100vh;
  display:flex;
  flex-direction:column;
  background:linear-gradient(180deg,#f8fbff 0%,#eef4ff 100%);
}
.hero{
  background:radial-gradient(1200px 400px at 10% -20%, var(--brand-500) 0%, var(--brand-700) 55%, #072a77 100%);
  color:#fff;
  border-radius:1rem;
  padding:2rem 2.5rem;
  margin-bottom:1.5rem;
  position:relative;
  overflow:hidden;
  box-shadow:0 10px 30px rgba(23,102,255,.25);
}
.hero::after{
  content:"";
  position:absolute; inset:0;
  background:url('data:image/svg+xml;utf8,<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="white" stop-opacity="0.08"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/></svg>') no-repeat center/cover;
  opacity:.35;
  mix-blend-mode:screen;
}
.card{
  border:0;
  border-radius:1rem;
  box-shadow:0 6px 18px rgba(13,82,214,.08);
}
.form-control:focus{
  border-color:var(--brand-500)!important;
  box-shadow:0 0 0 .25rem rgba(23,102,255,.15)!important;
}
.btn-primary,.btn-success{
  background:linear-gradient(180deg,var(--brand-500),var(--brand-700));
  border:0;
  box-shadow:0 8px 24px rgba(23,102,255,.25);
  transition:transform .12s ease,filter .2s ease;
}
.btn-primary:hover,.btn-success:hover{transform:translateY(-1px);filter:brightness(1.05);}
.btn-outline-secondary{
  border:1px solid #cfd9ff;
  border-radius:.6rem;
  transition:all .2s ease;
}
.btn-outline-secondary:hover{background:#f2f6ff;color:var(--brand-700);}
.badge.text-bg-primary{background:var(--brand-600);}
.alert-success{background:#e8f3ff;color:#0744a5;border:1px solid #bcd9ff;}
.alert-danger{background:#fff2f2;border:1px solid #ffd5d5;}
.list-group-item:hover{background:#f0f6ff;}
.toast-custom{
  position:fixed;bottom:20px;right:20px;
  background:#0b5ed7;color:#fff;
  padding:.8rem 1rem;border-radius:.6rem;
  box-shadow:0 10px 26px rgba(0,0,0,.2);
  opacity:0;transform:translateY(10px);
  transition:opacity .25s ease,transform .25s ease;
  pointer-events:none;
}
.toast-custom.show{opacity:1;transform:translateY(0);}
`;

/* ===== Main Component ===== */
export default function AddIrregularStudent() {
  const [nameQuery, setNameQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [levelInput, setLevelInput] = useState("");
  const [coursesText, setCoursesText] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [hasLoggedIn, setHasLoggedIn] = useState(null);
  const [previousCourses, setPreviousCourses] = useState(null);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const boxRef = useRef(null);
  const [showList, setShowList] = useState(false);
  const debouncedQuery = useDebounce(nameQuery, 300);

  /* ==== Search by name ==== */
  useEffect(() => {
    setOkMsg("");
    setErrMsg("");
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancel = false;
    const run = async () => {
      setSearching(true);
      try {
        const res = await API.get(`/irregular/students/search`, {
          params: { name: debouncedQuery, limit: 8 },
          ...getUserHeaders(),
        });
        if (!cancel) {
          setSuggestions(res.data?.results || []);
          setShowList(true);
        }
      } catch (e) {
        if (!cancel) {
          setSuggestions([]);
          setErrMsg(e.response?.data?.error || e.message || "Search failed.");
        }
      } finally {
        if (!cancel) setSearching(false);
      }
    };
    run();
    return () => {
      cancel = true;
    };
  }, [debouncedQuery]);

  /* ==== Close suggestion list ==== */
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowList(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  /* ==== Handle pick student ==== */
  const handlePick = (item) => {
    if (item?.isDisabled)
      return setErrMsg("This student is from another department.");
    setSelected(item);
    setNameQuery(item.fullName);
    setShowList(false);
    setSuggestions([]);
    setOkMsg("");
    setErrMsg("");

    API.get(`/irregular/students/${item.studentId}`, getUserHeaders())
      .then((r) => {
        const lvl = r.data?.level;
        setLevelInput(lvl === null || lvl === undefined ? "" : String(lvl));
        setHasLoggedIn(!!r.data?.hasLoggedIn);
        setPreviousCourses(r.data?.irregular?.PreviousLevelCourses ?? null);
      })
      .catch((e) => {
        setLevelInput("");
        setHasLoggedIn(null);
        setPreviousCourses(null);
        setErrMsg(e.response?.data?.error || e.message || "Lookup failed.");
      });
  };

  const handleClearStudent = () => {
    setSelected(null);
    setNameQuery("");
    setSuggestions([]);
    setShowList(false);
    setLevelInput("");
    setHasLoggedIn(null);
    setPreviousCourses(null);
    setCoursesText("");
    setOkMsg("");
    setErrMsg("");
  };

  /* ==== Save ==== */
  const handleSave = async (e) => {
    e.preventDefault();
    setOkMsg("");
    setErrMsg("");

    if (!selected?.studentId) return setErrMsg("Please select a student.");
    if (selected?.isDisabled)
      return setErrMsg("This student is from another department.");
    if (hasLoggedIn === false)
      return setErrMsg("This student has never logged in.");

    const payload = {
      studentId: Number(selected.studentId),
      courses: normalizeCoursesText(coursesText),
      level: String(levelInput).trim() === "" ? undefined : Number(levelInput),
      replace: replaceMode,
    };

    setSaving(true);
    try {
      const res = await API.post(`/irregular`, payload, getUserHeaders());
      const d = res.data?.data;
      setLevelInput(
        d?.level === null || d?.level === undefined ? "" : String(d.level)
      );
      setPreviousCourses(d?.PreviousLevelCourses ?? null);
      setCoursesText("");
      showToast("Saved successfully ✅");
    } catch (e) {
      setErrMsg(e.response?.data?.error || e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  /* ==== Toast ==== */
  function showToast(msg) {
    const toast = document.getElementById("toastBox");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="page-wrap">
        <main className="page-main">
          <div className="container py-5">
            {/* Hero */}
            <div className="hero">
              <h1 className="display-6 fw-bold mb-2">Add Irregular Student</h1>
              <p className="mb-0">
                Search, update level, and manage previous level courses.
              </p>
            </div>

            {/* Form */}
            <form className="card p-4" onSubmit={handleSave}>
              <div className="card-body">
                {/* Search */}
                <div className="mb-3" ref={boxRef} style={{ position: "relative" }}>
                  <label className="form-label fw-semibold">Student Name</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Type at least 2 letters…"
                      value={nameQuery}
                      onChange={(e) => {
                        setNameQuery(e.target.value);
                        setSelected(null);
                        if (e.target.value.length >= 2) setShowList(true);
                      }}
                      onFocus={() => nameQuery.length >= 2 && setShowList(true)}
                      required
                    />
                    {selected && (
                      <span className="input-group-text bg-light fw-bold">
                        ID: {selected.studentId}
                      </span>
                    )}
                    {selected && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={handleClearStudent}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {showList && (suggestions?.length > 0 || searching) && (
                    <div
                      className="list-group position-absolute w-100 shadow-sm"
                      style={{ zIndex: 10, maxHeight: 280, overflowY: "auto" }}
                    >
                      {searching && (
                        <div className="list-group-item disabled">Searching…</div>
                      )}
                      {suggestions.map((s) => {
                        const disabled = !!s.isDisabled;
                        return (
                          <button
                            key={s.studentId}
                            type="button"
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                            onClick={() => handlePick(s)}
                            disabled={disabled}
                            style={{ opacity: disabled ? 0.6 : 1 }}
                          >
                            <span>{s.fullName}</span>
                            <div className="d-flex align-items-center gap-2">
                              {disabled ? (
                                <span className="badge text-bg-secondary">
                                  Other dept
                                </span>
                              ) : (
                                <span className="badge text-bg-primary">
                                  SW Eng
                                </span>
                              )}
                              <small className="text-muted">
                                #{s.studentId}
                              </small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {hasLoggedIn === false && (
                  <div className="alert alert-warning">
                    This student has never logged in. Ask them to log in first.
                  </div>
                )}

                {/* Level */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Level</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="form-control"
                    value={levelInput}
                    onChange={(e) =>
                      setLevelInput(e.target.value.replace(/[^\d]/g, ""))
                    }
                    placeholder="1..8"
                  />
                </div>

                {/* Courses */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Previous Level Courses
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="PHY201, MATH202, RAD203 (comma or space separated)"
                    value={coursesText}
                    onChange={(e) => setCoursesText(e.target.value)}
                  />
                  <FormHelpPreview raw={coursesText} replaceMode={replaceMode} />
                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="replaceMode"
                      checked={replaceMode}
                      onChange={(e) => setReplaceMode(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="replaceMode">
                      Replace existing list instead of adding
                    </label>
                  </div>
                </div>

                {/* Saved */}
                {previousCourses?.length ? (
                  <div className="mb-3">
                    <div className="fw-semibold mb-2 text-primary">
                      Saved Previous Level Courses
                    </div>
                    <CoursePills arr={previousCourses} />
                  </div>
                ) : null}

                {/* Errors */}
                {errMsg && <div className="alert alert-danger">{errMsg}</div>}

                {/* Buttons */}
                <div className="d-flex gap-2 justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleClearStudent}
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || hasLoggedIn === false}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>

        {/* <div className="page-footer">
          <Footer />
        </div> */}
      </div>

      <div id="toastBox" className="toast-custom"></div>
    </>
  );
}

/* ===== Small Components ===== */
function FormHelpPreview({ raw, replaceMode }) {
  const arr = useMemo(() => normalizeCoursesText(raw), [raw]);
  if (!raw) return null;
  return (
    <small className="text-muted d-block mt-1">
      {replaceMode ? "Will replace with: " : "Will add: "} [{arr.join(", ")}]
    </small>
  );
}

function CoursePills({ arr = [] }) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return (
    <div className="d-flex flex-wrap gap-2">
      {arr.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="badge rounded-pill text-bg-primary px-3 py-2"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

/* ==== Simple debounce ==== */
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
