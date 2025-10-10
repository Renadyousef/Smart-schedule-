// src/components/Schedule/FixedSchedule.jsx
import React, { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const TIMES = [
  "08:00 - 08:50",
  "09:00 - 09:50",
  "10:00 - 10:50",
  "11:00 - 11:50",
  "13:00 - 13:50",
  "14:00 - 14:50",
  "15:00 - 15:50",
];

const PALETTE = {
  core: "#cce5ff",
  elective: "#fff9c4",
  lab: "#e1bee7",
  default: "#f8f9fa",
};

function normalizeType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "mandatory" || t === "core") return "core";
  if (t === "elective" || t === "optional") return "elective";
  if (t === "lab" || t === "laboratory") return "lab";
  return "core";
}
function colorOf(type) {
  const nt = normalizeType(type);
  if (nt === "core") return PALETTE.core;
  if (nt === "elective") return PALETTE.elective;
  if (nt === "lab") return PALETTE.lab;
  return PALETTE.default;
}
function titleCaseDay(dbDay) {
  if (!dbDay) return "";
  return dbDay.charAt(0).toUpperCase() + dbDay.slice(1).toLowerCase();
}
function hmToMin(hm) {
  const [h, m] = String(hm).split(":").map(Number);
  return h * 60 + m;
}

const SLOT_PARTS = TIMES.map((t) => {
  const [s, e] = t.split(" - ");
  return { s, e, sMin: hmToMin(s), eMin: hmToMin(e) };
});
const SLOT_STARTS = SLOT_PARTS.map((p) => p.s);

function rowsToSchedule(rows) {
  const out = {};
  for (const r of rows || []) {
    const day = titleCaseDay(r.DayOfWeek || r.day_of_week || r.day);
    if (!DAYS.includes(day)) continue;

    const startHM = String(r.StartTime || r.start_time).slice(0, 5);
    const endHM = String(r.EndTime || r.end_time).slice(0, 5);
    if (!startHM || !endHM || startHM.startsWith("12:")) continue;

    const startIdx = SLOT_STARTS.indexOf(startHM);
    if (startIdx === -1) continue;

    const sameEnd = SLOT_PARTS[startIdx].e;
    const nextEnd = SLOT_PARTS[startIdx + 1]?.e;
    let duration = 1;
    if (endHM === sameEnd) duration = 1;
    else if (nextEnd && endHM === nextEnd) duration = 2;
    else continue;

    const type = normalizeType(r.course_type);
    const subject = r.course_code
      ? `${r.course_code} — ${r.course_name}`
      : r.course_name || "Course";
    const room = r.room || "TBD";

    const label = TIMES[startIdx];
    out[day] ||= {};
    out[day][label] = {
      subject,
      room,
      type,
      duration,
      meta: {
        scheduleId: r.ScheduleID ?? null,
        level: r.Level ?? null,
        status: r.Status ?? null,
        sectionId: r.SectionID ?? null,
        courseCode: r.course_code ?? null,
        courseName: r.course_name ?? null,
        day,
        startHM,
        endHM,
      },
    };
  }
  return out;
}

function groupRowsBySchedule(rows) {
  const grouped = {};
  for (const row of rows || []) {
    const sid = row.ScheduleID;
    if (sid == null) continue;
    const level = row.Level ?? row.level ?? row.sch_level ?? row.schedule_level ?? "?";
    if (!grouped[sid]) grouped[sid] = { scheduleId: sid, level, rows: [] };
    grouped[sid].rows.push(row);
  }
  return Object.values(grouped).sort((a, b) => {
    const la = Number(a.level), lb = Number(b.level);
    if (!Number.isNaN(la) && !Number.isNaN(lb) && la !== lb) return la - lb;
    return a.scheduleId - b.scheduleId;
  });
}

export default function FixedSchedule({ apiBase = "http://localhost:5000" }) {
  const [scheduleGrid, setScheduleGrid] = useState({});
  const [scheduleIdCurrent, setScheduleIdCurrent] = useState(null);
  const [levelCurrent, setLevelCurrent] = useState(null);

  const [allSchedules, setAllSchedules] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState({ type: "", msg: "" });
  const [viewMode, setViewMode] = useState("your"); // "your" | "all"

  const [selectedTarget, setSelectedTarget] = useState(null); // { sectionId, subject, day, startHM, endHM } | null

  useEffect(() => {
    async function run() {
      setLoading(true);
      setErr("");
      try {
        const userRaw = localStorage.getItem("user");
        if (!userRaw) throw new Error("No user in localStorage");
        let user;
        try { user = JSON.parse(userRaw); } catch { throw new Error("Corrupted user in localStorage"); }

        const myLevel = user?.Level ?? user?.level;
        if (!myLevel && myLevel !== 0) throw new Error("No level found in localStorage");

        const token = localStorage.getItem("token");

        const fetchLevel = async (level) => {
          const url = new URL("/api/sections/courses-by-level", apiBase);
          url.searchParams.set("level", String(level));
          url.searchParams.set("status", "any");
          url.searchParams.set("includeSlots", "1");
          const res = await fetch(url.toString(), {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
          return payload;
        };

        if (viewMode === "your") {
          const payload = await fetchLevel(myLevel);
          const inferredScheduleId =
            payload?.scheduleId ??
            payload?.ScheduleID ??
            payload?.rows?.[0]?.ScheduleID ??
            null;

          setScheduleIdCurrent(inferredScheduleId);
          setLevelCurrent(myLevel);
          setAllSchedules([]);
          setCurrentIndex(0);
          setScheduleGrid(rowsToSchedule(payload.rows));
        } else {
          const levels = [1,2,3,4,5,6,7,8];
          const results = await Promise.allSettled(levels.map((lv) => fetchLevel(lv)));

          const collected = [];
          results.forEach((r, i) => {
            if (r.status !== "fulfilled") return;
            const payload = r.value;
            const grouped = groupRowsBySchedule(payload.rows || []);
            grouped.forEach(g => {
              if (g.level === "?" || g.level == null) g.level = levels[i];
              collected.push(g);
            });
          });

          if (collected.length === 0) {
            setAllSchedules([]);
            setCurrentIndex(0);
            setScheduleIdCurrent(null);
            setLevelCurrent(null);
            setScheduleGrid({});
          } else {
            collected.sort((a,b) => {
              const la = Number(a.level), lb = Number(b.level);
              if (la !== lb) return la - lb;
              return a.scheduleId - b.scheduleId;
            });
            setAllSchedules(collected);
            setCurrentIndex(0);
            setScheduleIdCurrent(collected[0].scheduleId);
            setLevelCurrent(collected[0].level);
            setScheduleGrid(rowsToSchedule(collected[0].rows));
          }
        }
      } catch (e) {
        setErr(e.message || "Failed to load schedule");
        setScheduleGrid({});
        setScheduleIdCurrent(null);
        setLevelCurrent(null);
        setAllSchedules([]);
        setCurrentIndex(0);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [apiBase, viewMode]);

  function showScheduleAt(idx) {
    if (idx < 0 || idx >= allSchedules.length) return;
    const it = allSchedules[idx];
    setCurrentIndex(idx);
    setScheduleIdCurrent(it.scheduleId);
    setLevelCurrent(it.level);
    setScheduleGrid(rowsToSchedule(it.rows));
  }

  function goNext() {
    if (allSchedules.length === 0) return;
    const next = (currentIndex + 1) % allSchedules.length;
    showScheduleAt(next);
  }
  function goPrev() {
    if (allSchedules.length === 0) return;
    const prev = (currentIndex - 1 + allSchedules.length) % allSchedules.length;
    showScheduleAt(prev);
  }

  const skip = useMemo(() => ({}), [scheduleGrid]);

  // فتح المودال عند الضغط على خلية (ونص افتتاحي اختياري)
  function onCellClick(slot) {
    if (!slot) return;
    setSelectedTarget({
      sectionId: slot.meta?.sectionId ?? null,
      subject: slot.subject,
      day: slot.meta?.day,
      startHM: slot.meta?.startHM,
      endHM: slot.meta?.endHM,
    });
    const prefix = `[${slot.meta?.day} ${slot.meta?.startHM}-${slot.meta?.endHM}] ${slot.subject}: `;
    setComment((prev) => (prev?.trim() ? prev : prefix));
    setShowModal(true);
  }

  async function submitFeedback() {
    setSubmitting(true);
    setFlash({ type: "", msg: "" });
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("user");
      const user = userRaw ? JSON.parse(userRaw) : {};
      const userId = user?.id ?? user?._id ?? user?.UserID ?? user?.StudentID ?? null;
      const role =
        user?.role || user?.Role || user?.userRole || (user?.isAdmin ? "admin" : "student");

      if (!token) throw new Error("Missing auth token");
      if (!userId) throw new Error("Missing user id");
      if (!scheduleIdCurrent) throw new Error("Missing schedule id");
      if (!comment.trim()) throw new Error("Write your feedback first");

      const body = {
        comment: comment.trim(),
        scheduleId: scheduleIdCurrent,
        courseId: null,
        role,
        userId,
      };

      const res = await fetch(`${apiBase}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setFlash({ type: "success", msg: "Feedback submitted successfully." });
      setShowModal(false);
      setComment("");
      setSelectedTarget(null);
    } catch (e) {
      setFlash({ type: "danger", msg: e.message || "Failed to submit feedback." });
    } finally {
      setSubmitting(false);
      setTimeout(() => setFlash({ type: "", msg: "" }), 4000);
    }
  }

  return (
    <div className="container my-4">
      <style>{`
        .view-dropdown .btn { background:#f7f9fc;border:1px solid #e1e6ef;border-radius:999px;color:#0b3a67;font-weight:700;padding:8px 14px; }
        .view-dropdown .btn:focus,.view-dropdown .btn.show { box-shadow:0 0 0 3px rgba(188,212,255,.35); border-color:#bcd4ff; }
        .view-dropdown .dropdown-menu { border-radius:12px; border:1px solid #e1e6ef; box-shadow:0 8px 24px rgba(16,24,40,.08); }
        .view-item { display:flex; align-items:center; gap:10px; padding:8px 12px; }
        .view-item .title { font-weight:700; color:#0b3a67; }
        .view-item .desc { font-size:.82rem; color:#5b6b7a; }
        .view-item .check { margin-left:auto; opacity:.9; }

        .table-fixed { table-layout:fixed; width:100%; border-collapse:separate; border-spacing:5px; }
        th,td { text-align:center; vertical-align:middle; height:70px; border:1px solid #dee2e6; border-radius:10px; padding:0; overflow:hidden; }
        .subject-box { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:600; font-size:.9rem; }
        .subject-box.clickable { cursor:pointer; transition: transform .06s ease; }
        .subject-box.clickable:active { transform: scale(.98); outline: 2px solid rgba(11,58,103,.2); }

        .room { font-size:.75rem; color:#333; }

        .legend-box { display:inline-flex; align-items:center; gap:8px; margin:0 10px; font-size:.9rem; font-weight:600; color:#333; }
        .legend-color { width:20px; height:20px; border-radius:6px; border:1px solid #bbb; }

        .btn-feedback { background-color:#e9f2ff; border:none; border-radius:30px; padding:14px 40px; font-weight:700; font-size:1.05rem; color:#0b3a67; }
        .btn-feedback:hover { background-color:#cce5ff; }

        .pager { gap:10px; }
      `}</style>

      {/* Dropdown */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="view-dropdown dropdown">
          <button className="btn dropdown-toggle" type="button" id="viewDropdown" data-bs-toggle="dropdown" aria-expanded="false">
            {viewMode === "your" ? "Your Level Schedule" : "All Levels Schedules"}
          </button>
          <ul className="dropdown-menu" aria-labelledby="viewDropdown">
            <li>
              <button className="dropdown-item view-item" onClick={() => setViewMode("your")}>
                <span><div className="title">Your Level Schedule</div><div className="desc">Based on your profile level</div></span>
                {viewMode === "your" && <span className="check">✓</span>}
              </button>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item view-item" onClick={() => setViewMode("all")}>
                <span><div className="title">All Levels Schedules</div><div className="desc">Browse one level at a time</div></span>
                {viewMode === "all" && <span className="check">✓</span>}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <h2 className="text-center mb-1">Preliminary Schedule</h2>
      <p className="text-center text-muted mb-3">
        Click any course cell to leave feedback about it, or use the button below for general notes.
      </p>

      {viewMode === "all" && levelCurrent != null && (
        <div className="text-center mb-2">
          <h5 className="mb-0">Level {String(levelCurrent)}</h5>
        </div>
      )}

      {flash.msg && <div className={`alert ${flash.type === "success" ? "alert-primary" : "alert-danger"} text-center`} role="alert">{flash.msg}</div>}
      {loading && <div className="alert alert-info text-center">Loading…</div>}
      {err && !loading && <div className="alert alert-danger text-center">{err}</div>}

      <table className="table-fixed">
        <thead>
          <tr>
            <th style={{ width: "140px", backgroundColor: "#f1f3f5" }}>Time</th>
            {DAYS.map((d) => (
              <th key={d} style={{ backgroundColor: "#f1f3f5" }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIMES.map((time, ti) => (
            <tr key={time}>
              <td className="fw-bold" style={{ backgroundColor: "#f9fafb", fontSize: "0.9rem" }}>{time}</td>
              {DAYS.map((day) => {
                const key = `${day}#${ti}`;
                if (skip[key]) return null;

                const slot = scheduleGrid?.[day]?.[time];
                if (!slot) return <td key={day}></td>;

                const bg = colorOf(slot.type);
                const rowSpan = Math.max(1, slot.duration || 1);

                if (rowSpan > 1) {
                  for (let k = 1; k < rowSpan; k++) {
                    const nextIdx = ti + k;
                    if (nextIdx < TIMES.length) skip[`${day}#${nextIdx}`] = true;
                  }
                }

                return (
                  <td key={day} rowSpan={rowSpan}>
                    <div
                      className="subject-box clickable"
                      style={{ backgroundColor: bg }}
                      onClick={() => onCellClick(slot)}
                      title="Click to give feedback on this course"
                    >
                      {slot.subject}
                      <div className="room">Room {slot.room}</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="d-flex justify-content-center align-items-center mt-4 flex-wrap gap-3">
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div><span>Core / Mandatory</span></div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.elective }}></div><span>Elective</span></div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div><span>Lab</span></div>
      </div>

      {/* زر فيدباك عام */}
      {viewMode === "your" && (
        <div className="text-center mt-3">
          <button
            className="btn btn-feedback"
            onClick={() => { setSelectedTarget(null); setComment(""); setShowModal(true); }}
            disabled={!scheduleIdCurrent}
            title={!scheduleIdCurrent ? "Schedule ID is missing" : "Give feedback"}
          >
            Give Feedback
          </button>
        </div>
      )}

      {/* Previous/Next */}
      {viewMode === "all" && allSchedules.length > 0 && (
        <div className="d-flex justify-content-center pager mt-4">
          <button className="btn btn-outline-secondary" onClick={goPrev} disabled={allSchedules.length <= 1}>Previous</button>
          <div className="small text-muted align-self-center mx-2">
            {currentIndex + 1} / {allSchedules.length}
          </div>
          <button className="btn btn-outline-primary" onClick={goNext} disabled={allSchedules.length <= 1}>Next</button>
        </div>
      )}

      {/* Modal (نفس الديزاين) */}
      {showModal && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: "20px" }}>
              <div className="modal-header" style={{ background: "#e9f2ff", color: "#0b3a67", borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}>
                <h5 className="modal-title">
                  Feedback{selectedTarget?.subject ? ` — ${selectedTarget.subject}` : ""}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                {selectedTarget && (
                  <div className="mb-2 small text-muted">
                    {selectedTarget.day} | {selectedTarget.startHM}–{selectedTarget.endHM}
                    {selectedTarget.sectionId ? ` | Section #${selectedTarget.sectionId}` : ""}
                  </div>
                )}
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Your feedback…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {!scheduleIdCurrent && <div className="text-danger small mt-2">Schedule ID is missing — please reload.</div>}
              </div>
              <div className="modal-footer d-flex gap-2">
                <button
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: "12px", padding: "8px 18px", fontWeight: "600" }}
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{
                    backgroundColor: "#e9f2ff",
                    color: "#0b3a67",
                    borderRadius: "12px",
                    padding: "8px 18px",
                    fontWeight: "600",
                    border: "none",
                    opacity: submitting || !comment.trim() || !scheduleIdCurrent ? 0.7 : 1,
                  }}
                  onClick={submitFeedback}
                  disabled={submitting || !comment.trim() || !scheduleIdCurrent}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
