import React, { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import API from "../../API_continer";

function getAuthToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") || null;
}

const SEEN_KEY = "irregular_seen_ids_v1";
const FP_KEY   = "irregular_fp_map_v1";
const NEW_KEY  = "irregular_new_ids_v1";

const NEW_BG = "#ffb020";
const NEW_FG = "#1f2a37";

function fingerprintRow(r) {
  const prev = Array.isArray(r.previousCourses)
    ? r.previousCourses.slice().sort().join("|")
    : "";

  return [
    String(r.studentId ?? ""),
    String(r.fullName ?? "").trim().toLowerCase(),
    String(r.email ?? "").trim().toLowerCase(),
    String(r.level ?? ""),
    prev,
  ].join("§");
}

export default function IrregularStudent() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const [hideSeen, setHideSeen] = useState(false);

  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  const [fpMap, setFpMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FP_KEY) || "{}");
    } catch {
      return {};
    }
  });

  const [newIds, setNewIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(NEW_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  const authCfg = useMemo(() => {
    const t = getAuthToken();
    return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
  }, []);

  // تخزين seen في localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {}
  }, [seen]);

  // تخزين fpMap في localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FP_KEY, JSON.stringify(fpMap));
    } catch {}
  }, [fpMap]);

  // تخزين newIds في localStorage
  useEffect(() => {
    try {
      localStorage.setItem(NEW_KEY, JSON.stringify([...newIds]));
    } catch {}
  }, [newIds]);

  async function fetchAll() {
    setState({ loading: true, error: "" });

    const pathsToTry = [
      "/irregular-student",
      "/api/irregular-student",
      "/irregular-student/",
      "/api/irregular-student/",
    ];

    let lastErr = null;

    for (const p of pathsToTry) {
      try {
        const { data } = await API.get(p, authCfg);
        const arr = Array.isArray(data) ? data : [];

        const nextFpMap = { ...fpMap };
        const nextNew = new Set(newIds);
        const nextSeen = new Set(seen);

        for (const r of arr) {
          const id = String(r.studentId);
          const fp = fingerprintRow(r);

          if (!nextFpMap[id]) {
            // أول مرة نشوفه → جديد
            nextNew.add(id);
          } else if (nextFpMap[id] !== fp) {
            // كان موجود وتغيّر → نعتبره "مُحدَّث" ونرجعه جديد
            nextNew.add(id);
            if (nextSeen.has(id)) nextSeen.delete(id);
          }

          nextFpMap[id] = fp;
        }

        // شيل أي IDs مو موجودة في الريسبونس الحالي
        for (const id of [...nextNew]) {
          if (!arr.some((r) => String(r.studentId) === id)) {
            nextNew.delete(id);
          }
        }

        for (const id of [...nextSeen]) {
          if (!arr.some((r) => String(r.studentId) === id)) {
            nextSeen.delete(id);
          }
        }

        setRows(arr);
        setFpMap(nextFpMap);
        setNewIds(nextNew);
        setSeen(nextSeen);

        setState({ loading: false, error: "" });
        setPage(1);
        return;
      } catch (err) {
        lastErr = err;
      }
    }

    const message =
      lastErr?.response?.data?.message ||
      (lastErr?.response?.status
        ? `Request failed with status code ${lastErr.response.status}`
        : lastErr?.message) ||
      "Unexpected error occurred.";

    setRows([]);
    setState({ loading: false, error: message });
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== فلترة + ترتيب ======
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows;

    // بحث بالاسم أو الإيميل
    if (term) {
      list = rows.filter(
        (r) =>
          (r.fullName || "").toLowerCase().includes(term) ||
          (r.email || "").toLowerCase().includes(term)
      );
    }

    // إخفاء السجلات اللي عليها seen لو المستخدم فعل الخيار
    if (hideSeen) {
      list = list.filter((r) => !seen.has(String(r.studentId)));
    }

    // 🔹 الترتيب:
    // 1) السجلات الجديدة/المحدّثة (newIds) تطلع فوق
    // 2) بعدين الباقي حسب studentId تنازلي (الأكبر أول)
    list = [...list].sort((a, b) => {
      const aId = String(a.studentId);
      const bId = String(b.studentId);

      const aNew = newIds.has(aId);
      const bNew = newIds.has(bId);

      // الجديد أو اللي تغيّر يطلع فوق
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;

      // بعدها نرتبهم بالأحدث (StudentID الأكبر) أول
      return Number(b.studentId) - Number(a.studentId);
    });

    return list;
  }, [rows, q, hideSeen, seen, newIds]);

  const needsPaging = filtered.length > pageSize;
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const paged = needsPaging
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const markSeen = (id) => {
    const key = String(id);

    setSeen((prev) => {
      const s = new Set(prev);
      s.add(key);
      return s;
    });

    setNewIds((prev) => {
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
  };

  return (
    <div className="container py-4">
      {/* زر Create Request */}
      <div className="d-flex justify-content-end mb-4">
        <button
          className="btn btn-primary px-4 py-2 fw-semibold"
          style={{ borderRadius: "8px" }}
          onClick={() => (window.location.href = "/requests/new")}
        >
          + Request Student Information
        </button>
      </div>

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 className="fw-bold text-primary m-0">Irregular Students</h2>

        <div className="d-flex gap-2 align-items-center">
          <div className="form-check me-2 small">
            <input
              id="hideSeen"
              className="form-check-input"
              type="checkbox"
              checked={hideSeen}
              onChange={(e) => {
                setHideSeen(e.target.checked);
                setPage(1);
              }}
            />
            <label htmlFor="hideSeen" className="form-check-label">
              Hide seen
            </label>
          </div>

          <input
            className="form-control"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: 260 }}
          />

          <button
            className="btn btn-outline-primary"
            onClick={fetchAll}
            disabled={state.loading}
          >
            {state.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Status */}
      {state.error && (
        <div className="alert alert-danger">{state.error}</div>
      )}

      {state.loading && !rows.length && (
        <div className="alert alert-info">Loading…</div>
      )}

      {!state.loading && !rows.length && !state.error && (
        <div className="alert alert-warning">
          No irregular student records found.
        </div>
      )}

      {/* Cards */}
      <div className="row g-4">
        {paged.map((r) => {
          const id = String(r.studentId);
          const isSeen = seen.has(id);
          const isNew = newIds.has(id);

          return (
            <div key={id} className="col-12">
              <div className="border border-primary-subtle rounded-4 overflow-hidden shadow-sm">
                {/* Blue header */}
                <div
                  className="d-flex align-items-center justify-content-between px-4 py-3"
                  style={{ backgroundColor: "#1766ff", color: "#fff" }}
                >
                  <div className="d-flex align-items-center gap-2 fw-semibold">
                    <span>Profile</span>

                    {isNew && (
                      <span
                        className="badge rounded-pill px-3 py-2"
                        style={{
                          background: NEW_BG,
                          color: NEW_FG,
                          border: "1px solid rgba(0,0,0,.05)",
                        }}
                      >
                        NEW +
                      </span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span className="badge rounded-pill bg-white text-primary px-3 py-2">
                      {r.level != null ? `Level ${r.level}` : "Level -"}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-4">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="mb-1 small fw-semibold text-primary">
                        Full Name
                      </label>
                      <input
                        readOnly
                        value={r.fullName ?? "-"}
                        className="form-control rounded-3 border-primary-subtle"
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="mb-1 small fw-semibold text-primary">
                        Email
                      </label>
                      <input
                        readOnly
                        value={r.email ?? "-"}
                        className="form-control rounded-3 border-primary-subtle"
                      />
                    </div>

                    {/* Previous Courses */}
                    <div className="col-12">
                      <div className="mb-2 small fw-semibold text-primary">
                        Previous Level Courses
                      </div>

                      {Array.isArray(r.previousCourses) &&
                      r.previousCourses.length > 0 ? (
                        <div className="d-flex flex-wrap gap-2">
                          {r.previousCourses.map((c, i) => (
                            <span
                              key={i}
                              className="badge rounded-pill"
                              style={{
                                background: "#fff",
                                color: "#1766ff",
                                border: "1px solid #cfe0ff",
                                padding: ".5rem .8rem",
                                fontWeight: 500,
                              }}
                            >
                              {String(c)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted small">
                          No previous level courses available.
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-12 d-flex justify-content-end">
                      <button
                        className={`btn ${
                          isSeen ? "btn-outline-secondary" : "btn-primary"
                        }`}
                        onClick={() => markSeen(id)}
                        disabled={isSeen}
                      >
                        Mark as seen
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="d-flex align-items-center justify-content-end mt-3 gap-2">
          <button
            className="btn btn-outline-primary"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="btn btn-outline-primary"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      <style>{`
        .border-primary-subtle {
          border-color: #cfe0ff !important;
        }
        .text-primary {
          color: #1766ff !important;
        }
      `}</style>
    </div>
  );
}
