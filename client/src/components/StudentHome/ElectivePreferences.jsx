// src/components/StudentHome/ElectivePreferences.jsx
import React, { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

/* ============ Categories (Labels) ============ */
const CATEGORY_META = {
  islamic:     { label: "Islamic" },
  mathscience: { label: "Math & Science" },
  cs_it:       { label: "CS / IT" },
};

/* ===== Helpers: read from localStorage ===== */
function readJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

function getUserIdFromLocalStorage() {
  const user = readJSON(localStorage.getItem("user"));
  if (user?.id) return user.id;
  if (user?._id) return user._id;
  if (user?.UserID) return user.UserID;
  return null;
}

function getAuthToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") || null;
}

/* ============ Draggable Card ============ */
function DraggableCard({ item, index, onDragStart, onDragOver, onDrop, onRemove }) {
  return (
    <div
      className="pref-card d-flex align-items-center justify-content-between mb-3"
      draggable
      onDragStart={(e)=>onDragStart(e,index)}
      onDragOver={(e)=>onDragOver(e,index)}
      onDrop={(e)=>onDrop(e,index)}
    >
      <div className="d-flex align-items-center gap-3">
        <span className="grab-handle" title="Drag to reorder">⋮⋮</span>
        <div>
          <div className="course-code fw-bold">{item.code}</div>
          <div className="course-name">{item.name}</div>
        </div>
      </div>
      <button className="btn btn-sm btn-outline-light" onClick={()=>onRemove(index)}>
        Remove
      </button>
    </div>
  );
}

/* ============ History Item ============ */
function HistoryItem({ item, onRestore }) {
  const when = new Date(item.created_at);
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  const prefs = Array.isArray(item.preferences) ? item.preferences : [];

  return (
    <div className="border rounded p-3 mb-2 bg-white shadow-sm">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <div className="fw-semibold">
            {when.toLocaleDateString()} — {when.toLocaleTimeString()}
          </div>
          <div className="text-muted small">
            {prefs.length} course(s)
            {reasons.length ? ` • reasons: ${reasons.join(", ")}` : ""}
            {item.notes ? ` • note: ${String(item.notes).slice(0,60)}${String(item.notes).length>60?"…":""}` : ""}
          </div>
        </div>
        <button className="btn btn-sm btn-outline-primary" onClick={()=>onRestore(item)}>
          Restore
        </button>
      </div>

      <details className="mt-2">
        <summary className="small text-muted">Show details</summary>
        <div className="mt-2">
          <div className="small text-uppercase text-muted fw-bold">Preferences</div>
          <ul className="mb-2">
            {prefs.map(p => (
              <li key={p.code} className="small">{p.order}. {p.code} — {p.name}</li>
            ))}
          </ul>
          {reasons.length > 0 && (
            <>
              <div className="small text-uppercase text-muted fw-bold">Reasons</div>
              <div className="small">{reasons.join(", ")}</div>
            </>
          )}
          {item.notes && (
            <>
              <div className="small text-uppercase text-muted fw-bold mt-2">Notes</div>
              <div className="small">{item.notes}</div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

/* ============ Main Component ============ */
export default function ElectivePreferences() {
  const [activeCat, setActiveCat] = useState("islamic");

  // Step 1 — student info
  const [level, setLevel] = useState(""); // from DB (read-only)
  const [reasons, setReasons] = useState({
    interest: false,
    gpa: false,
    easy: false,
    schedule: false,
  });
  const [notes, setNotes] = useState("");

  // Step 2 — pick & list
  const [selectedCode, setSelectedCode] = useState("");
  const [prefs, setPrefs] = useState([]);

  // History
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [histError, setHistError] = useState("");

  async function fetchHistory(studentId, token) {
    try {
      setLoadingHist(true);
      setHistError("");
      const res = await fetch(`http://localhost:5000/students/${studentId}/preferences/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setHistError("Failed to load history.");
    } finally {
      setLoadingHist(false);
    }
  }

  // Drag & Drop
  const [dragIndex, setDragIndex] = useState(null);
  const onDragStart = (e, idx) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (e, idx) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    setPrefs((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(idx, 0, moved);
      return copy;
    });
    setDragIndex(null);
  };

  /* ============ Fetch electives from backend ============ */
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [byCat, setByCat]     = useState({ islamic: [], mathscience: [], cs_it: [] });

  // Fetch student level + history (بدون تهيئة reasons/notes من DB)
  useEffect(() => {
    const studentId = getUserIdFromLocalStorage();
    const token = getAuthToken();

    if (!studentId) {
      console.warn("[Electives] No StudentID in localStorage.user.{id|_id|UserID}");
      return;
    }

    (async () => {
      try {
        console.debug("[Electives] fetching student info…", { studentId });
        const res = await fetch(`http://localhost:5000/students/${studentId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // normalize level only
        let lv = data?.level ?? "";
        if (lv !== null && lv !== undefined) {
          const n = Number(String(lv).match(/\d+/)?.[0] ?? lv);
          if (Number.isFinite(n) && n >= 1 && n <= 8) lv = String(n);
        } else {
          lv = "";
        }
        setLevel(lv);

        // لا نقوم بتهيئة reasons/notes من DB هنا (حتى لا ترجع بعد refresh)

        // fetch history
        await fetchHistory(studentId, token);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Fetch courses list
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        console.debug("[Electives] fetching courses…");
        const res  = await fetch("http://localhost:5000/courses");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const buckets = { islamic: [], mathscience: [], cs_it: [] };
        data.forEach(row => {
          const item = {
            code: row.course_code,
            name: row.course_name,
            DepartmentID: row.DepartmentID,
            CourseID: row.CourseID,
            credit_hours: row.credit_hours,
            is_external: row.is_external,
          };
          if (row.DepartmentID === 8) {
            buckets.islamic.push(item);
          } else if ([1,2,9].includes(row.DepartmentID)) {
            buckets.mathscience.push(item);
          } else if ([4,5,7,10].includes(row.DepartmentID)) {
            buckets.cs_it.push(item);
          }
        });

        for (const k of Object.keys(buckets)) {
          buckets[k].sort((a,b)=>a.code.localeCompare(b.code, undefined, { numeric:true }));
        }

        setByCat(buckets);
        console.debug("[Electives] courses loaded.", {
          islamic: buckets.islamic.length,
          mathscience: buckets.mathscience.length,
          cs_it: buckets.cs_it.length
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load elective courses.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const options = useMemo(() => byCat[activeCat] ?? [], [activeCat, byCat]);

  const addSelected = () => {
    if (!selectedCode) return;
    const found = options.find(o => o.code === selectedCode);
    if (!found) return;
    if (prefs.some(p => p.code === found.code)) return;
    setPrefs(prev => [...prev, found]);
    setSelectedCode("");
  };

  const removeAt = (idx) => setPrefs(prev => prev.filter((_, i) => i !== idx));

  const resetAll = () => {
    setReasons({ interest:false, gpa:false, easy:false, schedule:false });
    setNotes("");
    setPrefs([]);
    setSelectedCode("");
  };

  // Submit preferences + reasons + notes to DB
  const handleSubmit = async (e) => {
    e.preventDefault();

    const studentId = getUserIdFromLocalStorage();
    const token = getAuthToken();
    if (!studentId) {
      alert("Cannot submit: missing StudentID in localStorage.user");
      return;
    }

    const reasonsArr = Object.entries(reasons)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    const payload = {
      preferences: prefs.map((p, i) => ({
        order: i + 1,
        code: p.code,
        name: p.name,
        DepartmentID: p.DepartmentID,
        CourseID: p.CourseID,
        credit_hours: p.credit_hours,
        is_external: p.is_external,
      })),
      reasons: reasonsArr,
      notes: notes?.trim() || null,
    };

    console.debug("SUBMIT ELECTIVES →", { studentId, payload });

    try {
      const res = await fetch(`http://localhost:5000/students/${studentId}/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status} – ${t}`);
      }
      await res.json();

      // toast
      const toast = document.getElementById("submitToast");
      if (toast) {
        toast.textContent = "Preferences saved successfully";
        toast.classList.add("show");
        setTimeout(()=>toast.classList.remove("show"), 2200);
      }

      // صفّي الحقول بعد الحفظ (reasons + notes + selectedCode)
      setReasons({ interest:false, gpa:false, easy:false, schedule:false });
      setNotes("");
      setSelectedCode("");
      // إن أردت أيضًا تصفية قائمة التفضيلات بعد الحفظ، أزل التعليق التالي:
      // setPrefs([]);

      // refresh history after save
      await fetchHistory(studentId, token);
    } catch (err) {
      console.error(err);
      alert("Failed to save preferences. See console for details.");
    }
  };

  // Restore from a history record
  const handleRestore = (item) => {
    const prefsArr = Array.isArray(item.preferences) ? item.preferences : [];
    const reasonsArr = Array.isArray(item.reasons) ? item.reasons : [];

    const sorted = [...prefsArr].sort((a,b)=>(a.order||0)-(b.order||0));
    setPrefs(sorted.map(p => ({
      code: p.code,
      name: p.name,
      DepartmentID: p.DepartmentID,
      CourseID: p.CourseID,
      credit_hours: p.credit_hours,
      is_external: p.is_external,
    })));

    setReasons({
      interest: reasonsArr.includes("interest"),
      gpa:      reasonsArr.includes("gpa"),
      easy:     reasonsArr.includes("easy"),
      schedule: reasonsArr.includes("schedule"),
    });

    setNotes(item.notes || "");
    const toast = document.getElementById("submitToast");
    if (toast) {
      toast.textContent = "History restored to the form";
      toast.classList.add("show");
      setTimeout(()=>toast.classList.remove("show"), 1800);
    }
  };

  return (
    <div className="electives-bg py-4">
      <div className="container">
        {/* Hero */}
        <div className="hero card border-0 shadow-lg mb-4 overflow-hidden">
          <div className="hero-overlay"></div>
          <div className="card-body position-relative text-white">
            <h1 className="display-6 fw-bold mb-2">Elective Course Preferences</h1>
            <p className="mb-0">
              Submit your elective preferences — pick from categories, then drag to order your priority list.
            </p>
          </div>
        </div>

        {/* Error/Loading */}
        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <div className="alert alert-info">Loading elective courses…</div>}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="row g-4">
            {/* Step 1 */}
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0">
                  <h5 className="mb-0 fw-bold text-primary">Step 1 — Student Info</h5>
                </div>
                <div className="card-body">
                  {/* Level from DB (read-only) */}
                  <div className="mb-3">
                    <label className="form-label">Level</label>
                    <input
                      className="form-control"
                      value={level ? `Level ${level}` : ""}
                      placeholder="—"
                      readOnly
                    />
                    {!level && (
                      <div className="form-text text-danger">
                        Level not found. Added in Your profile
                      </div>
                    )}
                  </div>

                  {/* Reasons + notes */}
                  <div className="mb-3">
                    <label className="form-label d-block">Reasons for selection</label>
                    <div className="row g-2">
                      <div className="col-6">
                        <div className="form-check custom-check">
                          <input className="form-check-input" type="checkbox" id="r1"
                            checked={reasons.interest}
                            onChange={(e)=>setReasons(s=>({...s, interest:e.target.checked}))}/>
                          <label className="form-check-label" htmlFor="r1">Personal Interest</label>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="form-check custom-check">
                          <input className="form-check-input" type="checkbox" id="r2"
                            checked={reasons.gpa}
                            onChange={(e)=>setReasons(s=>({...s, gpa:e.target.checked}))}/>
                          <label className="form-check-label" htmlFor="r2">Improve GPA</label>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="form-check custom-check">
                          <input className="form-check-input" type="checkbox" id="r3"
                            checked={reasons.easy}
                            onChange={(e)=>setReasons(s=>({...s, easy:e.target.checked}))}/>
                          <label className="form-check-label" htmlFor="r3">Lighter Workload</label>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="form-check custom-check">
                          <input className="form-check-input" type="checkbox" id="r4"
                            checked={reasons.schedule}
                            onChange={(e)=>setReasons(s=>({...s, schedule:e.target.checked}))}/>
                          <label className="form-check-label" htmlFor="r4">Fits My Schedule</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Notes (optional)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={notes}
                      onChange={(e)=>setNotes(e.target.value)}
                      placeholder="e.g., prefer morning classes, avoid labs on Sunday…"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
                  <h5 className="mb-0 fw-bold text-primary">Step 2 — Pick Courses</h5>
                  <span className="text-muted small">Select, then add to the list</span>
                </div>
                <div className="card-body">
                  {/* Category tabs */}
                  <div className="nav nav-pills gap-2 mb-3 flex-wrap">
                    {Object.keys(CATEGORY_META).map(key=>(
                      <button
                        key={key}
                        type="button"
                        onClick={()=>setActiveCat(key)}
                        className={`btn btn-sm pill-tab ${activeCat===key ? "active" : ""}`}
                      >
                        {CATEGORY_META[key].label}
                      </button>
                    ))}
                  </div>

                  {/* Dropdown + add */}
                  <div className="row g-2 align-items-end">
                    <div className="col-md-8">
                      <label className="form-label">{CATEGORY_META[activeCat].label} — Courses</label>
                      <select
                        className="form-select glow-input"
                        value={selectedCode}
                        onChange={(e)=>setSelectedCode(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">{loading ? "Loading…" : "Select a course…"}</option>
                        {(byCat[activeCat] ?? []).map(c=>(
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <button type="button" className="btn btn-primary w-100 add-btn" onClick={addSelected} disabled={!selectedCode}>
                        Add to Preferences
                      </button>
                    </div>
                  </div>

                  <hr className="my-4"/>

                  {/* Step 3 */}
                  <div className="mb-3">
                    <h5 className="fw-bold text-primary d-block">Step 3 — Rank Your Preferences</h5>
                    <p className="text-muted small mb-0">
                      Drag the cards to rank them. 1 = highest priority.
                    </p>
                  </div>

                  {prefs.length === 0 ? (
                    <div className="empty-state text-center p-4">
                      <div className="emoji mb-2"></div>
                      <div className="fw-semibold">No courses added yet</div>
                      <div className="text-muted small">Pick from the dropdown above, then click “Add to Preferences”.</div>
                    </div>
                  ) : (
                    <div>
                      {prefs.map((p, i)=>(
                        <DraggableCard
                          key={p.code}
                          item={p}
                          index={i}
                          onDragStart={onDragStart}
                          onDragOver={onDragOver}
                          onDrop={onDrop}
                          onRemove={removeAt}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="card-footer bg-white border-0 d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-outline-secondary" onClick={resetAll}>
                    Reset
                  </button>
                  <button type="submit" className="btn btn-primary submit-btn">
                    Submit Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* History */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-bold text-primary">Submission History</h5>
            {loadingHist && <span className="text-muted small">Loading…</span>}
          </div>
          <div className="card-body">
            {histError && <div className="alert alert-danger">{histError}</div>}
            {(!history || history.length === 0) ? (
              <div className="text-muted">No history yet.</div>
            ) : (
              history.map((h) => (
                <HistoryItem key={h.id} item={h} onRestore={handleRestore} />
              ))
            )}
          </div>
        </div>

        {/* Toast */}
        <div id="submitToast" className="toast-custom">Preferences submitted </div>
      </div>

      {/* ====== Styles (Blue theme + effects) ====== */}
      <style>{`
        :root{
          --brand-500:#1766ff;
          --brand-600:#0d52d6;
          --brand-700:#0a3ea7;
          --brand-50:#ecf3ff;
        }
        .electives-bg{
          background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
          min-height: 100vh;
        }
        .hero{
          background: radial-gradient(1200px 400px at 10% -20%, var(--brand-500) 0%, var(--brand-700) 55%, #072a77 100%);
          color:#fff;
        }
        .hero-overlay{
          position:absolute; inset:0;
          background: url('data:image/svg+xml;utf8,<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="white" stop-opacity="0.08"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/></svg>') no-repeat center/cover;
          opacity:.35;
          mix-blend-mode: screen;
        }
        .pill-tab{
          background:#f2f6ff;
          color:#2a3b6a;
          border:1px solid #e3ebff;
          border-radius:999px;
          padding:.45rem 1rem;
          transition: all .2s ease;
        }
        .pill-tab:hover{ transform: translateY(-1px); }
        .pill-tab.active{
          background: var(--brand-600);
          color:#fff; border-color:transparent;
          box-shadow: 0 8px 24px rgba(13,82,214,.25);
        }
        .glow-input:focus{
          border-color: var(--brand-500) !important;
          box-shadow: 0 0 0 .25rem rgba(23,102,255,.15) !important;
        }
        .add-btn{
          box-shadow: 0 6px 16px rgba(23,102,255,.25);
          transition: transform .12s ease, box-shadow .2s ease;
        }
        .add-btn:hover{ transform: translateY(-1px); }
        .custom-check .form-check-input:checked{
          background-color: var(--brand-600);
          border-color: var(--brand-600);
        }
        .empty-state{
          background: var(--brand-50);
          border:1px dashed #cfe0ff;
          border-radius: .75rem;
        }
        .empty-state .emoji{ font-size: 1.6rem; }

        .pref-card{
          background: linear-gradient(180deg, var(--brand-600), var(--brand-700));
          color:#fff;
          border-radius: .85rem;
          padding: .9rem 1rem;
          box-shadow: 0 8px 24px rgba(7,42,119,.25);
          cursor: grab;
          transition: transform .1s ease, box-shadow .2s ease;
        }
        .pref-card:hover{ transform: translateY(-2px); }
        .pref-card:active{ cursor: grabbing; }

        .course-code{ color: #ffffff; font-size: 1.05rem; }
        .course-name{ color: #ffffff; opacity: .95; font-size: 1rem; }

        .grab-handle{
          display:inline-flex;
          align-items:center; justify-content:center;
          width:26px; height:26px;
          border-radius:.5rem;
          background: rgba(255,255,255,.14);
          font-weight:700;
          letter-spacing: -1px;
          padding-bottom:2px;
        }
        .submit-btn{
          background: linear-gradient(180deg, var(--brand-500), var(--brand-700));
          border:0;
          box-shadow: 0 10px 28px rgba(23,102,255,.35);
          transition: transform .12s ease, filter .2s ease;
        }
        .submit-btn:hover{ transform: translateY(-1px); filter: brightness(1.05); }
        .toast-custom{
          position: fixed;
          bottom: 20px; right: 20px;
          background: #0b5ed7;
          color: #fff;
          padding: .7rem 1rem;
          border-radius: .6rem;
          box-shadow: 0 10px 26px rgba(0,0,0,.2);
          opacity: 0; transform: translateY(10px);
          transition: opacity .25s ease, transform .25s ease;
          pointer-events: none;
        }
        .toast-custom.show{ opacity: 1; transform: translateY(0); }
      `}</style>
    </div>
  );
}
