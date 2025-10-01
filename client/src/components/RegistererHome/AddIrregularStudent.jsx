// client/src/pages/AddIrregularStudent.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getUserHeaders() {
  const userId = localStorage.getItem("userId");
  return userId ? { headers: { "X-User-Id": userId } } : {};
}

/** فلترة ورصنمة أكواد المقررات القادمة من حقل النص */
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

export default function AddIrregularStudent() {
  // البحث بالاسم + قائمة اقتراحات
  const [nameQuery, setNameQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]); // {studentId, fullName}[]
  const [selected, setSelected] = useState(null);     // {studentId, fullName}

  // الحقول المعروضة/القابلة للتعديل
  const [levelInput, setLevelInput] = useState("");       // level (editable)
  const [coursesText, setCoursesText] = useState("");     // يتم حفظه في PreviousLevelCourses
  const [replaceMode, setReplaceMode] = useState(false);  // اختياري: استبدال بدل الإضافة

  // معلومات إضافية
  const [hasLoggedIn, setHasLoggedIn] = useState(null);
  const [previousCourses, setPreviousCourses] = useState(null);

  // حالات واجهة
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // إدارة قائمة الاقتراحات
  const boxRef = useRef(null);
  const [showList, setShowList] = useState(false);
  const debouncedQuery = useDebounce(nameQuery, 300);

  /* ------------ البحث بالأسم (مع ديباونس) ------------ */
  useEffect(() => {
    setOkMsg(""); setErrMsg("");
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancel = false;
    const run = async () => {
      setSearching(true);
      try {
        const res = await axios.get(
          `${API_BASE}/irregular/students/search`,
          { params: { name: debouncedQuery, limit: 8 }, ...getUserHeaders() }
        );
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
    return () => { cancel = true; };
  }, [debouncedQuery]);

  /* ------------ إغلاق قائمة الاقتراحات ------------ */
  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowList(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  /* ------------ عند اختيار طالب ------------ */
  const handlePick = (item) => {
    setSelected(item);
    setNameQuery(item.fullName);
    setShowList(false);
    setSuggestions([]);
    setOkMsg(""); setErrMsg("");

    axios.get(`${API_BASE}/irregular/students/${item.studentId}`, getUserHeaders())
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
    setOkMsg(""); setErrMsg("");
  };

  /* ------------ حفظ ------------ */
  const handleSave = async (e) => {
    e.preventDefault();
    setOkMsg(""); setErrMsg("");

    if (!selected?.studentId) return setErrMsg("Please select a student.");
    if (hasLoggedIn === false) {
      return setErrMsg("This student has never logged in.");
    }

    const payload = {
      studentId: Number(selected.studentId),
      courses: normalizeCoursesText(coursesText),
      level: String(levelInput).trim() === "" ? undefined : Number(levelInput),
      replace: replaceMode, // افتراضيًا false → إضافة
    };

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/irregular`, payload, getUserHeaders());
      const d = res.data?.data;
      setLevelInput(d?.level === null || d?.level === undefined ? "" : String(d.level));
      setPreviousCourses(d?.PreviousLevelCourses ?? null);
      setCoursesText("");
      setOkMsg("Saved successfully ✅");
    } catch (e) {
      setErrMsg(e.response?.data?.error || e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    handleClearStudent();
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Add Irregular Student</h2>

      <form className="card shadow-sm" onSubmit={handleSave}>
        <div className="card-body">

          {/* اختيار الطالب بالاسم */}
          <div className="mb-3" ref={boxRef} style={{ position: "relative" }}>
            <label className="form-label">Student Name</label>
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
              {selected ? <span className="input-group-text">ID: {selected.studentId}</span> : null}
              {selected ? (
                <button type="button" className="btn btn-outline-secondary" onClick={handleClearStudent}>
                  Clear
                </button>
              ) : null}
            </div>

            {showList && (suggestions?.length > 0 || searching) && (
              <div
                className="list-group"
                style={{ position: "absolute", zIndex: 10, width: "100%", maxHeight: 280, overflowY: "auto" }}
              >
                {searching && <div className="list-group-item disabled">Searching…</div>}
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.studentId}
                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    onClick={() => handlePick(s)}
                  >
                    <span>{s.fullName}</span>
                    <small className="text-muted">#{s.studentId}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* تحذير لو الطالب ما قد سجّل دخول */}
          {hasLoggedIn === false && (
            <div className="alert alert-warning">
              This student has never logged in. Ask them to log in at least once before you can add irregular data.
            </div>
          )}

          {/* level */}
          <div className="mb-3">
            <label className="form-label">Level</label>
            <input
              type="number"
              min={1}
              max={12}
              className="form-control"
              value={levelInput}
              onChange={(e) => setLevelInput(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="1..12"
            />
            {/* <small className="text-muted">اتركه فارغًا لو ما تبين تغيّرينه؛ إن كان فارغ لن يتم تعديله.</small> */}
          </div>

          {/* Previous Level Courses */}
          <div className="mb-2">
            <label className="form-label">Previous Level Courses</label>
            <input
              type="text"
              className="form-control"
              placeholder="PHY201, MATH202, RAD203  (comma OR space separated)"
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
                Replace existing list (instead of adding)
              </label>
            </div>
          </div>

          {/* عرض المحفوظ سابقًا */}
          {previousCourses?.length ? (
            <div className="mb-3">
              <div className="fw-semibold mb-1">Saved Previous Level Courses</div>
              <CoursePills arr={previousCourses} />
            </div>
          ) : null}

          {/* Alerts */}
          {okMsg && <div className="alert alert-success">{okMsg}</div>}
          {errMsg && <div className="alert alert-danger">{errMsg}</div>}

          {/* أزرار */}
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-success" disabled={saving || hasLoggedIn === false}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** معاينة فورية للكورسات */
function FormHelpPreview({ raw, replaceMode }) {
  const arr = useMemo(() => normalizeCoursesText(raw), [raw]);
  if (!raw) return null;
  return (
    <small className="text-muted d-block mt-1">
      {replaceMode ? "Will replace with: " : "Will add: "}[{arr.join(", ")}]
    </small>
  );
}

/** بادجات للكورسات */
function CoursePills({ arr = [] }) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return (
    <div className="d-flex flex-wrap gap-2">
      {arr.map((c, i) => (
        <span key={`${c}-${i}`} className="badge rounded-pill text-bg-primary">
          {c}
        </span>
      ))}
    </div>
  );
}

/** هوك ديباونس بسيط */
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
