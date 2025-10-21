import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Container, Row, Col, Button, Form, Spinner } from "react-bootstrap";
import API from "../../API_continer"; // ✅ تمّت الإضافة

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const LECTURE_MULTI_DAY_VALUE = "Sunday-Tuesday-Thursday";
const LECTURE_MULTI_DAY_DAYS = ["Sunday", "Tuesday", "Thursday"];
const LECTURE_DAY_OPTIONS = [...DAYS, LECTURE_MULTI_DAY_VALUE];
const STORAGE_KEY = "sc.activeScheduleId";
const EVENT_NAME = "sc-schedule-changed";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const fallback = axios.create({ baseURL: API_BASE });
const http = API || fallback;

function withAuth(config = {}) {
  if (typeof window === "undefined") return config;
  const token = window.localStorage.getItem("token");
  if (!token) return config;
  return {
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
}

const initialForm = {
  courseCode: "",
  courseName: "",
  sectionNumber: "1",
  capacity: "",
  lecture: { day: "Sunday", start: "", end: "" },
  tutorial: { enabled: false, day: "Sunday", start: "", end: "" },
  lab: { enabled: false, day: "Sunday", start: "", end: "" },
};

export default function ExternalCourses() {
  const [externalRows, setExternalRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [scheduleId, setScheduleId] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? null : parsed;
  });

  const syncSchedule = useCallback((value, broadcast = false) => {
    const numeric = value === null || value === undefined ? null : Number(value);
    const normalized = Number.isNaN(numeric) ? null : numeric;
    setScheduleId(normalized);
    if (typeof window !== "undefined") {
      if (normalized !== null) {
        window.localStorage.setItem(STORAGE_KEY, String(normalized));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      if (broadcast) {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (evt) => {
      const nextId = evt.detail === null || evt.detail === undefined ? null : Number(evt.detail);
      const normalized = Number.isNaN(nextId) ? null : nextId;
      if (normalized === scheduleId) return;
      syncSchedule(normalized, false);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [scheduleId, syncSchedule]);

  useEffect(() => {
    async function ensureSchedule() {
      if (scheduleId) return;
      try {
        const { data } = await http.post("/schedule/init", null, withAuth());
        const nextId = data?.scheduleId ?? null;
        if (nextId) {
          syncSchedule(Number(nextId), true);
        }
      } catch (err) {
        console.error("Init schedule failed:", err);
      }
    }
    ensureSchedule();
  }, [scheduleId, syncSchedule]);

  const loadExternal = useCallback(
    async (id) => {
      if (!id) {
        setExternalRows([]);
        return;
      }
      const { data } = await http.get(
        `/schedule/core-courses/slots/${id}`,
        withAuth()
      );
      setExternalRows(data);
    },
    []
  );

  useEffect(() => {
    if (scheduleId) {
      loadExternal(scheduleId).catch((err) =>
        console.error("Load external slots failed:", err)
      );
    } else {
      setExternalRows([]);
    }
  }, [scheduleId, loadExternal]);

  const updateLecture = (patch) =>
    setForm((prev) => ({ ...prev, lecture: { ...prev.lecture, ...patch } }));
  const updateTutorial = (patch) =>
    setForm((prev) => ({ ...prev, tutorial: { ...prev.tutorial, ...patch } }));
  const updateLab = (patch) =>
    setForm((prev) => ({ ...prev, lab: { ...prev.lab, ...patch } }));

  const add = async () => {
    if (!scheduleId) return;
    const { courseCode, courseName, sectionNumber, capacity, lecture, tutorial, lab } = form;

    if (!courseCode.trim() || !courseName.trim()) {
      alert("Enter course code and name");
      return;
    }

    if (!sectionNumber) {
      alert("Enter base section number");
      return;
    }

    if (!lecture.start || !lecture.end) {
      alert("Lecture time is required");
      return;
    }

    const baseSection = Number(sectionNumber);
    if (Number.isNaN(baseSection)) {
      alert("Section number must be numeric");
      return;
    }

    const slots = [];

    const lectureDays =
      lecture.day === LECTURE_MULTI_DAY_VALUE ? LECTURE_MULTI_DAY_DAYS : [lecture.day];

    lectureDays.forEach((day) => {
      slots.push({
        sectionNumber: baseSection,
        dayOfWeek: day,
        startTime: lecture.start,
        endTime: lecture.end,
      });
    });

    if (tutorial.enabled && tutorial.start && tutorial.end) {
      slots.push({
        sectionNumber: baseSection + 1,
        dayOfWeek: tutorial.day,
        startTime: tutorial.start,
        endTime: tutorial.end,
        type: "tutorial",
      });
    }

    if (lab.enabled && lab.start && lab.end) {
      slots.push({
        sectionNumber: baseSection + 2,
        dayOfWeek: lab.day,
        startTime: lab.start,
        endTime: lab.end,
        type: "lab",
      });
    }

    setBusy(true);
    try {
      let latestScheduleId = scheduleId;
      for (const entry of slots) {
        const payload = {
          scheduleId: latestScheduleId,
          courseCode,
          courseName,
          sectionNumber: entry.sectionNumber,
          capacity,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
        };
        const { data } = await http.post(
          "/schedule/core-courses/slots",
          payload,
          withAuth()
        );
        const receivedId = data?.scheduleId ? Number(data.scheduleId) : null;
        if (Number.isFinite(receivedId) && receivedId !== latestScheduleId) {
          latestScheduleId = receivedId;
          syncSchedule(latestScheduleId, true);
        }
      }

      await loadExternal(latestScheduleId);
      setForm(initialForm);
      setMsg("✅ External course saved");
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      console.error("Add external course failed:", err);
      alert("Failed to add external course");
    } finally {
      setBusy(false);
    }
  };

  if (!scheduleId)
    return (
      <Container className="p-5 text-center">
        <Spinner animation="border" /> Selecting schedule...
      </Container>
    );

  const baseSectionNumber = Number(form.sectionNumber);
  const hasBaseSection = !!form.sectionNumber && !Number.isNaN(baseSectionNumber);

  return (
    <Container className="py-4">
      <style>{`
        .sc-panel { background: #fff; border-radius: 20px; padding: 24px 28px; border: 1px solid #e2e8f5; box-shadow: 0 14px 32px rgba(12, 33, 68, 0.08); }
        .sc-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .sc-title h4 { margin: 0; font-weight: 700; color: #113355; }
        .sc-meta { font-size: 0.84rem; color: #4b5c7b; font-weight: 500; }
        .sc-toast { background: rgba(19, 98, 223, 0.08); border: 1px solid rgba(19, 98, 223, 0.18); color: #124173; border-radius: 12px; padding: 10px 16px; font-weight: 600; font-size: 0.9rem; margin-bottom: 18px; }
        .sc-section { background: #f9fbff; border-radius: 16px; padding: 18px 20px; border: 1px solid #e7edf8; margin-bottom: 18px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6); }
        .sc-section__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .sc-section__header h5 { margin: 0; font-size: 1.02rem; font-weight: 600; color: #10294a; }
        .sc-section__hint { font-size: 0.78rem; color: #60739a; }
        .sc-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #3f4d68; background: rgba(63, 77, 104, 0.08); padding: 4px 12px; border-radius: 999px; }
        .sc-card-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; padding: 0; margin: 0; }
        .sc-card { background: #fff; border-radius: 14px; padding: 16px 18px; border: 1px solid #e0e6f4; box-shadow: 0 8px 20px rgba(15, 30, 60, 0.05); display: flex; flex-direction: column; gap: 6px; }
        .sc-card__code { font-weight: 700; font-size: 0.95rem; color: #132c4e; }
        .sc-card__meta { font-size: 0.82rem; color: #4d5d7a; }
        .sc-empty { background: #f4f7ff; border: 1px dashed #c9d4ef; border-radius: 14px; padding: 26px; text-align: center; color: #65759b; font-weight: 500; }
        .sc-actions { text-align: right; margin-top: 6px; }
        .sc-actions .btn { min-width: 160px; font-weight: 600; border-radius: 10px; padding: 9px 18px; }
      `}</style>

      <div className="sc-panel">
        <div className="sc-title">
          <h4>External / Elective Course Builder</h4>
          <span className="sc-meta">Create manual slots for your active schedule</span>
        </div>

        {msg && <div className="sc-toast">{msg}</div>}

        <section className="sc-section">
          <div className="sc-section__header">
            <h5>Course Details</h5>
            <span className="sc-section__hint">Add the essentials before picking times</span>
          </div>
          <Row className="gy-2 gx-3">
            <Col md={3}>
              <Form.Label>Course Code</Form.Label>
              <Form.Control
                placeholder="e.g., CSC381"
                value={form.courseCode}
                onChange={(e) => setForm({ ...form, courseCode: e.target.value })}
              />
            </Col>
            <Col md={5}>
              <Form.Label>Course Name</Form.Label>
              <Form.Control
                placeholder="Course name"
                value={form.courseName}
                onChange={(e) => setForm({ ...form, courseName: e.target.value })}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Section #</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={form.sectionNumber}
                onChange={(e) => setForm({ ...form, sectionNumber: e.target.value })}
              />
            </Col>
            <Col md={2}>
              <Form.Label>Capacity</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </Col>
          </Row>
        </section>

        <section className="sc-section">
          <div className="sc-section__header">
            <h5>Lecture Time</h5>
            <span className="sc-section__hint">Required — supports multi-day patterns</span>
          </div>
          <Row className="gy-2 gx-3">
            <Col md={3}>
              <Form.Label>Day</Form.Label>
              <Form.Select
                value={form.lecture.day}
                onChange={(e) => updateLecture({ day: e.target.value })}
              >
                {LECTURE_DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === LECTURE_MULTI_DAY_VALUE ? "Sunday / Tuesday / Thursday" : d}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label>Start</Form.Label>
              <Form.Control
                type="time"
                value={form.lecture.start}
                onChange={(e) => updateLecture({ start: e.target.value })}
              />
            </Col>
            <Col md={3}>
              <Form.Label>End</Form.Label>
              <Form.Control
                type="time"
                value={form.lecture.end}
                onChange={(e) => updateLecture({ end: e.target.value })}
              />
            </Col>
            <Col md={3}>
              <Form.Label>Section</Form.Label>
              <Form.Control value={form.sectionNumber || ""} readOnly />
            </Col>
          </Row>
        </section>

        <section className="sc-section">
          <div className="sc-section__header">
            <h5>Tutorial</h5>
            <span className="sc-toggle">
              <Form.Check
                type="switch"
                id="tutorial-switch"
                label={form.tutorial.enabled ? "Enabled" : "Disabled"}
                checked={form.tutorial.enabled}
                onChange={(e) => updateTutorial({ enabled: e.target.checked })}
              />
            </span>
          </div>
          {form.tutorial.enabled ? (
            <Row className="gy-2 gx-3">
              <Col md={3}>
                <Form.Label>Day</Form.Label>
                <Form.Select
                  value={form.tutorial.day}
                  onChange={(e) => updateTutorial({ day: e.target.value })}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Start</Form.Label>
                <Form.Control
                  type="time"
                  value={form.tutorial.start}
                  onChange={(e) => updateTutorial({ start: e.target.value })}
                />
              </Col>
              <Col md={3}>
                <Form.Label>End</Form.Label>
                <Form.Control
                  type="time"
                  value={form.tutorial.end}
                  onChange={(e) => updateTutorial({ end: e.target.value })}
                />
              </Col>
              <Col md={3}>
                <Form.Label>Section</Form.Label>
                <Form.Control value={hasBaseSection ? baseSectionNumber + 1 : ""} readOnly />
              </Col>
            </Row>
          ) : (
            <span className="sc-section__hint">Toggle on if the course provides a tutorial slot.</span>
          )}
        </section>

        <section className="sc-section">
          <div className="sc-section__header">
            <h5>Lab</h5>
            <span className="sc-toggle">
              <Form.Check
                type="switch"
                id="lab-switch"
                label={form.lab.enabled ? "Enabled" : "Disabled"}
                checked={form.lab.enabled}
                onChange={(e) => updateLab({ enabled: e.target.checked })}
              />
            </span>
          </div>
          {form.lab.enabled ? (
            <Row className="gy-2 gx-3">
              <Col md={3}>
                <Form.Label>Day</Form.Label>
                <Form.Select
                  value={form.lab.day}
                  onChange={(e) => updateLab({ day: e.target.value })}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Start</Form.Label>
                <Form.Control
                  type="time"
                  value={form.lab.start}
                  onChange={(e) => updateLab({ start: e.target.value })}
                />
              </Col>
              <Col md={3}>
                <Form.Label>End</Form.Label>
                <Form.Control
                  type="time"
                  value={form.lab.end}
                  onChange={(e) => updateLab({ end: e.target.value })}
                />
              </Col>
              <Col md={3}>
                <Form.Label>Section</Form.Label>
                <Form.Control value={hasBaseSection ? baseSectionNumber + 2 : ""} readOnly />
              </Col>
            </Row>
          ) : (
            <span className="sc-section__hint">Enable if the elective includes a lab component.</span>
          )}
        </section>

        <div className="sc-actions">
          <Button onClick={add} disabled={busy}>
            {busy ? "Saving..." : "Save Course"}
          </Button>
        </div>

        <section className="sc-section">
          <div className="sc-section__header">
            <h5>Scheduled External / Elective Courses</h5>
            <span className="sc-section__hint">Updated after each save</span>
          </div>
          {externalRows.length ? (
            <ul className="sc-card-list">
              {externalRows.map((r, i) => (
                <li key={i} className="sc-card">
                  <span className="sc-card__code">
                    {r.course_code} — {r.course_name}
                  </span>
                  <span className="sc-card__meta">Section {r.section_number} • Capacity {r.capacity}</span>
                  <span className="sc-card__meta">
                    {r.day_of_week} {r.start_time?.slice(0, 5)} – {r.end_time?.slice(0, 5)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="sc-empty">No external slots added yet.</div>
          )}
        </section>
      </div>
    </Container>
  );
}
