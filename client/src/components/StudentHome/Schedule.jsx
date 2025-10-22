// client/src/components/Schedule/FixedSchedule.jsx
import React, { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer";

/* الأيام للعرض فقط — الداتا من الـAPI */
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

/* ألوان الأنواع */
const PALETTE = {
  core: "#cce5ff",
  tutorial: "#ffe0b2",
  lab: "#e1bee7",
  elective: "#fff9c4",
  default: "#f8f9fa",
};

/* استثناءات تثبيت نوع المادة */
const COURSE_TYPE_OVERRIDES = {
  SWE444: "core",
};

function normalizeType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "tutorial") return "tutorial";
  if (t === "lab" || t === "laboratory") return "lab";
  if (t === "elective" || t === "optional") return "elective";
  return "core";
}
function colorOf(type) {
  const nt = normalizeType(type);
  if (nt === "tutorial") return PALETTE.tutorial;
  if (nt === "lab") return PALETTE.lab;
  return PALETTE.core;
}

/* وقت */
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

/* منطق داخلي: أحد/ثلاثاء/خميس محاضرات */
const INTERNAL_LECTURE_DAYS = new Set(["Sunday", "Tuesday", "Thursday"]);

/* 1) تحويل /grid-by-level -> rows */
function groupsGridToRows(groups) {
  const rows = [];
  for (const g of groups || []) {
    const meta = g?.meta || {};
    const scheduleId = g?.scheduleId ?? null;
    const level = meta.level ?? null;
    const status = meta.status ?? null;
    const groupNo = meta.groupNo ?? null;

    for (const s of g?.slots || []) {
      rows.push({
        ScheduleID: scheduleId,
        Level: level,
        Status: status,
        GroupNo: groupNo,

        course_code: s.course_code,
        course_name: s.course_name,
        course_type: null,

        SectionID: s.section_id,
        section_number: s.section_number ?? null,
        is_external: !!s.is_external,

        room: s.section_number ? String(s.section_number).padStart(3, "0") : "000",
        DayOfWeek: s.day,
        StartTime: s.start,
        EndTime: s.end,
      });
    }
  }
  return rows;
}

/* 2) أصغر شعبة لكل كورس (للـ external) */
function buildBaseSectionByCourse(rows) {
  const base = {};
  for (const r of rows || []) {
    if (!r.is_external) continue;
    if (!r.course_code) continue;
    const n = Number(r.section_number);
    if (!Number.isFinite(n)) continue;
    base[r.course_code] =
      base[r.course_code] === undefined ? n : Math.min(base[r.course_code], n);
  }
  return base;
}

/* 3) rows -> grid + تحديد النوع/اللون */
function rowsToSchedule(rows) {
  const out = {};
  const baseSectionByCourse = buildBaseSectionByCourse(rows);

  for (const r of rows || []) {
    const rawDay = String(r.DayOfWeek || r.day_of_week || r.day || "").trim();
    const day = titleCaseDay(rawDay);
    if (!DAYS.includes(day)) continue;

    const startHM = String(r.StartTime || r.start_time).slice(0, 5);
    const endHM = String(r.EndTime || r.end_time).slice(0, 5);
    if (!startHM || !endHM || startHM.startsWith("12:")) continue;

    const startIdx = SLOT_STARTS.indexOf(startHM);
    if (startIdx === -1) continue;

    // مدة الامتداد
    const sameEnd = SLOT_PARTS[startIdx].e;
    const nextEnd = SLOT_PARTS[startIdx + 1]?.e;
    let duration = 1;
    if (endHM === sameEnd) duration = 1;
    else if (nextEnd && endHM === nextEnd) duration = 2;
    else {
      const durMin = Math.max(hmToMin(endHM) - hmToMin(startHM), 0);
      duration = durMin >= 100 ? 2 : 1;
    }

    // تحديد النوع
    let type = "core";
    const nameLower = String(r.course_name || "").toLowerCase();

    if (r.is_external) {
      const base = baseSectionByCourse[r.course_code];
      const sn = Number(r.section_number);
      if (Number.isFinite(base) && Number.isFinite(sn)) {
        const diff = sn - base;
        if (diff === 1) type = "tutorial";
        else if (diff >= 2) type = "lab";
        else type = "core";
      }
    } else {
      if (/lab|laborator/.test(nameLower)) type = "lab";
      else if (/tutorial/.test(nameLower)) type = "tutorial";
      else {
        const isLectureDay = INTERNAL_LECTURE_DAYS.has(day);
        type = (isLectureDay || duration > 1) ? "core" : "tutorial";
      }
    }

    // استثناءات ثابتة
    const cc = String(r.course_code || "").toUpperCase();
    if (COURSE_TYPE_OVERRIDES[cc]) type = COURSE_TYPE_OVERRIDES[cc];

    // بناء الخلية
    const subject = r.course_code ? `${r.course_code} — ${r.course_name}` : r.course_name || "Course";
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
        groupNo: r.GroupNo ?? r.group_no ?? null,
        sectionId: r.SectionID ?? null,
        courseCode: r.course_code ?? null,
        courseName: r.course_name ?? null,
        isExternal: !!r.is_external,
        sectionNumber: r.section_number ?? null,
        day,
        startHM,
        endHM,
      },
    };
  }
  return out;
}

/* تجميع حسب ScheduleID */
function groupRowsBySchedule(rows) {
  const grouped = {};
  for (const row of rows || []) {
    const sid = row.ScheduleID;
    if (sid == null) continue;
    const level = row.Level ?? row.level ?? "?";
    const groupNo = row.GroupNo ?? row.group_no ?? null;
    if (!grouped[sid]) grouped[sid] = { scheduleId: sid, level, groupNo, rows: [] };
    grouped[sid].rows.push(row);
    if (grouped[sid].groupNo == null && groupNo != null) grouped[sid].groupNo = groupNo;
  }
  return Object.values(grouped).sort((a, b) => {
    const la = Number(a.level), lb = Number(b.level);
    if (!Number.isNaN(la) && !Number.isNaN(lb) && la !== lb) return la - lb;
    const ga = Number(a.groupNo ?? 0), gb = Number(b.groupNo ?? 0);
    if (ga !== gb) return ga - gb;
    return a.scheduleId - b.scheduleId;
  });
}

/* تجميع القروبات لكل لفل */
function buildLevelBuckets(allGroups) {
  const map = new Map();
  for (const g of allGroups) {
    const lvl = Number(g.level);
    if (!map.has(lvl)) map.set(lvl, { level: lvl, groups: [] });
    map.get(lvl).groups.push(g);
  }
  const buckets = Array.from(map.values());
  buckets.forEach((b) => {
    b.groups.sort((a, b2) => {
      const ga = Number(a.groupNo ?? 1);
      const gb = Number(b2.groupNo ?? 1);
      if (ga !== gb) return ga - gb;
      return a.scheduleId - b2.scheduleId;
    });
  });
  buckets.sort((a, b) => a.level - b.level);
  return buckets;
}

/* هل فيه أي خلايا جدول؟ */
function hasAnyScheduleCells(grid) {
  if (!grid || typeof grid !== "object") return false;
  for (const day of DAYS) {
    const col = grid[day];
    if (col && Object.keys(col).length > 0) return true;
  }
  return false;
}

export default function FixedSchedule() {
  const [viewMode, setViewMode] = useState("your"); // "your" | "all"

  const [scheduleGrid, setScheduleGrid] = useState({});
  const [scheduleIdCurrent, setScheduleIdCurrent] = useState(null);
  const [levelCurrent, setLevelCurrent] = useState(null);
  const [groupNoCurrent, setGroupNoCurrent] = useState(null);

  const [yourGroups, setYourGroups] = useState([]);
  const [yourGroupPos, setYourGroupPos] = useState(0);

  const [levelBuckets, setLevelBuckets] = useState([]);
  const [levelPos, setLevelPos] = useState(0);
  const [groupPosInLevel, setGroupPosInLevel] = useState(0);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState({ type: "", msg: "" });

  const [showModal, setShowModal] = useState(false);
  const [comment, setComment] = useState("");
  0
  const [submitting, setSubmitting] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);

  const [missingLevel, setMissingLevel] = useState(false); // Your: ما فيه level

  const skip = useMemo(() => ({}), [scheduleGrid]);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authCfg = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  useEffect(() => {
    async function run() {
      setLoading(true);
      setErr("");
      setMissingLevel(false);
      try {
        const userRaw = localStorage.getItem("user");
        if (!userRaw) throw new Error("No user in localStorage");
        let user;
        try { user = JSON.parse(userRaw); } catch { throw new Error("Corrupted user in localStorage"); }

        const myLevel = user?.Level ?? user?.level;

        // Your + ما فيه level => رسالة بدل الخطأ
        if (viewMode === "your" && (myLevel === undefined || myLevel === null || myLevel === "")) {
          setMissingLevel(true);
          setScheduleGrid({});
          setScheduleIdCurrent(null);
          setLevelCurrent(null);
          setGroupNoCurrent(null);
          setYourGroups([]);
          setYourGroupPos(0);
          setLevelBuckets([]);
          setLevelPos(0);
          setGroupPosInLevel(0);
          return;
        }

        const fetchLevelGroups = async (level) => {
          const { data: payload } = await API.get("/api/sections/grid-by-level", {
            params: { level: String(level) },
            ...authCfg,
          });
          const rows = groupsGridToRows(payload?.groups || []);
          const grouped = groupRowsBySchedule(rows);
          return { level, groups: grouped };
        };

        if (viewMode === "your") {
          const { groups } = await fetchLevelGroups(myLevel);
          const safeGroups = groups.length
            ? groups
            : [{ scheduleId: null, level: myLevel, groupNo: 1, rows: [] }];

          setYourGroups(safeGroups);
          setYourGroupPos(0);

          const g = safeGroups[0];
          setScheduleIdCurrent(g.scheduleId);
          setLevelCurrent(myLevel);
          setGroupNoCurrent(g.groupNo ?? 1);
          setScheduleGrid(rowsToSchedule(g.rows));
        } else {
          const levels = [1,2,3,4,5,6,7,8];
          const results = await Promise.allSettled(levels.map((lv) => fetchLevelGroups(lv)));

          const allGroups = [];
          results.forEach((r) => {
            if (r.status !== "fulfilled") return;
            const { level, groups } = r.value;
            if (!groups.length) {
              allGroups.push({ scheduleId: null, level, groupNo: 1, rows: [] });
            } else {
              allGroups.push(...groups);
            }
          });

          const buckets = buildLevelBuckets(allGroups);
          setLevelBuckets(buckets);

          const firstLevelIdx = buckets.findIndex(b => Array.isArray(b.groups) && b.groups.length > 0);
          if (firstLevelIdx === -1) {
            setLevelPos(0);
            setGroupPosInLevel(0);
            setScheduleIdCurrent(null);
            setLevelCurrent(null);
            setGroupNoCurrent(null);
            setScheduleGrid({});
          } else {
            setLevelPos(firstLevelIdx);
            setGroupPosInLevel(0);
            const curLevel = buckets[firstLevelIdx];
            const curGroup = curLevel.groups[0];
            setScheduleIdCurrent(curGroup.scheduleId);
            setLevelCurrent(curLevel.level);
            setGroupNoCurrent(curGroup.groupNo ?? 1);
            setScheduleGrid(rowsToSchedule(curGroup.rows));
          }
        }
      } catch (e) {
        setErr(e.message || "Failed to load schedule");
        setScheduleGrid({});
        setScheduleIdCurrent(null);
        setLevelCurrent(null);
        setGroupNoCurrent(null);
        setYourGroups([]);
        setYourGroupPos(0);
        setLevelBuckets([]);
        setLevelPos(0);
        setGroupPosInLevel(0);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [viewMode]); // يعتمد على API

  function selectGroupByIndex(i) {
    if (viewMode === "your") {
      if (i < 0 || i >= yourGroups.length) return;
      setYourGroupPos(i);
      const g = yourGroups[i];
      setScheduleIdCurrent(g.scheduleId);
      setLevelCurrent(g.level);
      setGroupNoCurrent(g.groupNo ?? 1);
      setScheduleGrid(rowsToSchedule(g.rows));
    } else {
      const curBucket = levelBuckets[levelPos] || { groups: [] };
      if (i < 0 || i >= curBucket.groups.length) return;
      setGroupPosInLevel(i);
      const g = curBucket.groups[i];
      setScheduleIdCurrent(g.scheduleId);
      setLevelCurrent(curBucket.level);
      setGroupNoCurrent(g.groupNo ?? 1);
      setScheduleGrid(rowsToSchedule(g.rows));
    }
  }

  function onCellClick(slot) {
    setSelectedTarget(slot.meta ? { ...slot.meta, subject: slot.subject } : { subject: slot.subject });
    setComment("");
    setShowModal(true);
  }

  /* تنقّل بين المستويات (All) */
  function goNextLevel() {
    if (viewMode !== "all" || levelBuckets.length === 0) return;
    const next = (levelPos + 1) % levelBuckets.length;
    setLevelPos(next);
    setGroupPosInLevel(0);
    const nb = levelBuckets[next];
    const g = nb.groups[0] || { rows: [], scheduleId: null, groupNo: 1 };
    setScheduleIdCurrent(g.scheduleId);
    setLevelCurrent(nb.level);
    setGroupNoCurrent(g.groupNo ?? 1);
    setScheduleGrid(rowsToSchedule(g.rows));
  }
  function goPrevLevel() {
    if (viewMode !== "all" || levelBuckets.length === 0) return;
    const prev = (levelPos - 1 + levelBuckets.length) % levelBuckets.length;
    setLevelPos(prev);
    setGroupPosInLevel(0);
    const nb = levelBuckets[prev];
    const g = nb.groups[0] || { rows: [], scheduleId: null, groupNo: 1 };
    setScheduleIdCurrent(g.scheduleId);
    setLevelCurrent(nb.level);
    setGroupNoCurrent(g.groupNo ?? 1);
    setScheduleGrid(rowsToSchedule(g.rows));
  }

  const headerLevel =
    viewMode === "your" ? (yourGroups[yourGroupPos]?.level ?? levelCurrent) :
    (levelBuckets[levelPos]?.level ?? levelCurrent);

  const headerGroupNo =
    viewMode === "your" ? (yourGroups[yourGroupPos]?.groupNo ?? groupNoCurrent) :
    (levelBuckets[levelPos]?.groups?.[groupPosInLevel]?.groupNo ?? groupNoCurrent);

  const tabsForThisView = viewMode === "your" ? yourGroups : (levelBuckets[levelPos]?.groups || []);

  const hasData = useMemo(() => hasAnyScheduleCells(scheduleGrid), [scheduleGrid]);
  const renderMissingLevelMsg = (!loading && !err && viewMode === "your" && missingLevel);

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

        .nav-tabs .nav-link {
          border: 1px solid #e1e6ef; border-bottom:none; margin-right:6px;
          border-top-left-radius:12px; border-top-right-radius:12px;
          color:#0b3a67; font-weight:600; background:#f7f9fc;
        }
        .nav-tabs .nav-link.active {
          background:#fff; border-color:#bcd4ff #bcd4ff #fff;
        }
        .tab-card {
          border:1px solid #e1e6ef; border-radius:0 12px 12px 12px;
          padding:12px; background:#fff; box-shadow:0 8px 24px rgba(16,24,40,.05);
        }

        @media (max-width: 768px) {
          .table-fixed { display:block; overflow-x:auto; white-space:nowrap; }
          th, td { font-size:.75rem; height:55px; padding:2px; }
          .subject-box { font-size:.75rem; line-height:1.1; padding:4px; }
          .room { font-size:.65rem; }
          .tab-card { padding:8px; }
        }
        @media (max-width: 390px) {
          .subject-box { font-size:.7rem; }
          th, td { font-size:.7rem; height:50px; }
        }
      `}</style>

      {/* View dropdown */}
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

      {(headerLevel != null) && !renderMissingLevelMsg && (
        <div className="text-center mb-2">
          <h5 className="mb-2">
            Level {String(headerLevel)}
            {headerGroupNo != null ? ` — Group ${headerGroupNo}` : ""}
          </h5>
        </div>
      )}

      {/* Group Tabs */}
      {!renderMissingLevelMsg && tabsForThisView.length > 1 && (
        <>
          <ul className="nav nav-tabs justify-content-center mb-0">
            {tabsForThisView.map((g, i) => {
              const isActive = (viewMode === "your" ? yourGroupPos : groupPosInLevel) === i;
              const labelNo = g?.groupNo ?? (i + 1);
              return (
                <li className="nav-item" key={`${g.scheduleId ?? "x"}-${i}`}>
                  <button
                    className={`nav-link ${isActive ? "active" : ""}`}
                    onClick={() => selectGroupByIndex(i)}
                  >
                    Group {labelNo}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="tab-card mt-0 mb-3"></div>
        </>
      )}

      {/* Alerts */}
      {flash.msg && <div className={`alert ${flash.type === "success" ? "alert-primary" : "alert-danger"} text-center`} role="alert">{flash.msg}</div>}
      {loading && <div className="alert alert-info text-center">Loading…</div>}
      {err && !loading && <div className="alert alert-danger text-center">{err}</div>}

      {/* رسالة: لا يوجد Level في وضع Your */}
      {renderMissingLevelMsg && (
        <div className="d-flex justify-content-center">
          <div className="alert alert-light border text-center w-100" style={{ maxWidth: 680 }}>
            <div className="fw-bold mb-1">Set your level in Profile to view your schedule.</div>
          </div>
        </div>
      )}

      {/* رسالة: لا يوجد جدول (تظهر مع بقاء أزرار Previous/Next خارج هذا الشرط) */}
      {!renderMissingLevelMsg && !loading && !err && !hasData && (
        <div className="d-flex justify-content-center">
          <div className="alert alert-light border text-center w-100" style={{ maxWidth: 680 }}>
            <div className="fw-bold mb-1">Schedule is not available now.</div>
            <div className="text-muted small">Please check back later.</div>
          </div>
        </div>
      )}

      {/* جدول (فقط عند توفر بيانات) */}
      {!renderMissingLevelMsg && hasData && (
        <>
          <div className={tabsForThisView.length > 1 ? "tab-card" : ""}>
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
          </div>

          {/* Legend */}
          <div className="d-flex justify-content-center align-items-center mt-4 flex-wrap gap-3">
            <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div><span> Lecture</span></div>
            <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.tutorial }}></div><span>Tutorial</span></div>
            <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div><span>Lab</span></div>
          </div>

          {/* زر الفيدباك */}
          <div className="text-center mt-3">
            <button
              className="btn btn-feedback"
              onClick={() => { setSelectedTarget(null); setComment(""); setShowModal(true); }}
              disabled={!scheduleIdCurrent}
              title={!scheduleIdCurrent ? "Schedule ID is missing — switch group/level or reload." : "Give feedback"}
            >
              Give Feedback
            </button>
          </div>
        </>
      )}

      {/* Pager لوضع All — ظاهر دائمًا حتى لو الجدول فاضي (المسج تظهر ومعها الأزرار) */}
      {viewMode === "all" && levelBuckets.length > 0 && (
        <div className="d-flex justify-content-center pager mt-4">
          <button className="btn btn-outline-secondary" onClick={goPrevLevel} disabled={levelBuckets.length <= 1}>
            Previous Level
          </button>
          <div className="small text-muted align-self-center mx-2">
            {levelPos + 1} / {levelBuckets.length}
          </div>
          <button className="btn btn-outline-primary" onClick={goNextLevel} disabled={levelBuckets.length <= 1}>
            Next Level
          </button>
        </div>
      )}

      {/* Modal */}
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
                  onClick={async () => {
                    setSubmitting(true);
                    setFlash({ type: "", msg: "" });
                    try {
                      const userRaw = localStorage.getItem("user");
                      const user = userRaw ? JSON.parse(userRaw) : {};
                      const userId = user?.id ?? user?._id ?? user?.UserID ?? user?.StudentID ?? null;
                      const role = user?.role || user?.Role || user?.userRole || (user?.isAdmin ? "admin" : "student");
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

                      await API.post("/api/feedback", body, authCfg);

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
                  }}
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
