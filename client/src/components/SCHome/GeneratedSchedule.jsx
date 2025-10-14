import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { Container, Spinner, Alert, Button, Nav, Modal, Form, Row, Col } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

/* ====== Constants ====== */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const LECTURE_MULTI_DAY_VALUE = "Sunday-Tuesday-Thursday";
const LECTURE_MULTI_DAY_DAYS = ["Sunday", "Tuesday", "Thursday"];
const LECTURE_DAY_OPTIONS = [...DAYS, LECTURE_MULTI_DAY_VALUE];
const INTERNAL_LECTURE_DAYS = new Set(["Sunday", "Tuesday", "Thursday"]);
const TIMES = [
  "08:00 - 08:50",
  "09:00 - 09:50",
  "10:00 - 10:50",
  "11:00 - 11:50",
  "13:00 - 13:50",
  "14:00 - 14:50",
  "15:00 - 15:50",
];
const SLOT_PARTS = TIMES.map((slot) => {
  const [start, end] = slot.split(" - ");
  return { start, end };
});
const START_TO_INDEX = SLOT_PARTS.reduce((acc, part, idx) => {
  acc[part.start] = idx;
  return acc;
}, {});
const PALETTE = {
  core: "#cce5ff",
  tutorial: "#ffe0b2",
  lab: "#e1bee7",
  elective: "#fff9c4",
  default: "#f8f9fa",
};

const STORAGE_KEY = "sc.activeScheduleId";
const EVENT_NAME = "sc-schedule-changed";

const ADD_FORM_TEMPLATE = {
  courseCode: "",
  courseName: "",
  sectionNumber: "1",
  capacity: "",
  isExternal: true,
  lecture: { day: DAYS[0], start: "", end: "" },
  tutorial: { enabled: false, day: DAYS[0], start: "", end: "" },
  lab: { enabled: false, day: DAYS[0], start: "", end: "" },
};

function colorOf(type) {
  if (type === "core") return PALETTE.core;
  if (type === "elective") return PALETTE.elective;
  if (type === "lab") return PALETTE.lab;
  if (type === "tutorial") return PALETTE.tutorial;
  return PALETTE.default;
}

function timeToMinutes(time) {
  if (!time) return 0;
  const [h = "0", m = "0"] = String(time).split(":");
  return Number(h) * 60 + Number(m);
}

export default function GeneratedSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [scheduleId, setScheduleId] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? null : parsed;
  });
  const scheduleIdRef = useRef(scheduleId);
  const [scheduleData, setScheduleData] = useState({});
  const [slotList, setSlotList] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [slotEdits, setSlotEdits] = useState({});
  const [editorMsg, setEditorMsg] = useState(null);
  const [editorError, setEditorError] = useState(null);
  const [savingSlotId, setSavingSlotId] = useState(null);
  const [removingSlotId, setRemovingSlotId] = useState(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [addForm, setAddForm] = useState(() => ({ ...ADD_FORM_TEMPLATE }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [approving, setApproving] = useState(false);

  const token = localStorage.getItem("token");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: "http://localhost:5000/schedule",
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const persistScheduleId = useCallback((value) => {
    if (typeof window === "undefined") return;
    if (value !== null) {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const broadcastScheduleId = useCallback((value) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
  }, []);

  const updateActiveSchedule = useCallback(
    (value, broadcast = false) => {
      const numeric = value === null || value === undefined ? null : Number(value);
      const normalized = Number.isNaN(numeric) ? null : numeric;
      scheduleIdRef.current = normalized;
      persistScheduleId(normalized);
      if (broadcast) {
        broadcastScheduleId(normalized);
      }
      setScheduleId(normalized);
    },
    [broadcastScheduleId, persistScheduleId]
  );

  /* ---- Load all schedules ---- */
  useEffect(() => {
    async function fetchSchedules() {
      setLoadingList(true);
      try {
        let { data } = await api.get("/list");
        let rows = data ?? [];

        if (!rows.length) {
          try {
            const { data: created } = await api.post("/init");
            if (created?.scheduleId) {
              const refreshed = await api.get("/list");
              rows = refreshed.data ?? [];
            }
          } catch (err) {
            console.error("Init schedule on empty list failed:", err);
          }
        }

        setSchedules(rows);
        if (rows.length) {
          const current = scheduleIdRef.current;
          const preferred = rows.some((s) => s.ScheduleID === current)
            ? current
            : Number(rows[0].ScheduleID);
          updateActiveSchedule(preferred, false);
        } else {
          updateActiveSchedule(null, false);
        }
      } catch (err) {
        console.error("Fetch schedules failed:", err);
      } finally {
        setLoadingList(false);
      }
    }
    fetchSchedules();
  }, [api, updateActiveSchedule]);

  const loadGrid = async (id) => {
    if (!id) {
      setScheduleData({});
      setSlotList([]);
      return;
    }
    try {
      const { data } = await api.get(`/grid/${id}`);
      const normalizedSlots = (data ?? []).map((slot) => ({
        ...slot,
        start: slot.start ? slot.start.slice(0, 5) : "",
        end: slot.end ? slot.end.slice(0, 5) : "",
      }));

      const tableData = {};
      const baseSectionByCourse = {};

      for (const slot of normalizedSlots) {
        if (slot.is_external && slot.course_code) {
          const sectionNum = Number(slot.section_number);
          if (Number.isFinite(sectionNum)) {
            const existing = baseSectionByCourse[slot.course_code];
            baseSectionByCourse[slot.course_code] =
              existing === undefined ? sectionNum : Math.min(existing, sectionNum);
          }
        }
      }

      for (const slot of normalizedSlots) {
        const day = slot.day;
        if (!tableData[day]) tableData[day] = {};
        const start = slot.start;
        const end = slot.end;
        let label = `${start} - ${end}`;

        let type = "lab";
        let labelType = "Lab";
        let subtitle = "Lab";
        let span = 1;
        if (slot.is_external) {
          type = "core";
          labelType = "Lecture";
          subtitle = "Lecture";
          const sectionNum = Number(slot.section_number);
          const base = baseSectionByCourse[slot.course_code];
          if (Number.isFinite(sectionNum) && Number.isFinite(base)) {
            const diff = sectionNum - base;
            if (diff === 1) {
              type = "tutorial";
              labelType = "Tutorial";
              subtitle = "Tutorial";
            } else if (diff >= 2) {
              type = "lab";
              labelType = "Lab";
              subtitle = "Lab";
            }
          }
        } else {
          labelType = "Internal";
          subtitle = "Internal";
        }

        const durationMinutes = Math.max(
          timeToMinutes(slot.end) - timeToMinutes(slot.start),
          0
        );
        const startIdx = START_TO_INDEX[start];
        if (startIdx !== undefined) {
          label = TIMES[startIdx];
          const slotEnd = SLOT_PARTS[startIdx].end;
          const nextEnd = SLOT_PARTS[startIdx + 1]?.end;
          if (end === nextEnd) {
            span = 2;
          } else if (end === slotEnd) {
            span = 1;
          } else if (durationMinutes >= 100) {
            span = 2;
          }
          if (span > 1) {
            span = Math.min(span, TIMES.length - startIdx);
          }
        } else if (durationMinutes >= 100) {
          span = 2;
        }

        if (!slot.is_external) {
          const isLectureDay = INTERNAL_LECTURE_DAYS.has(day);
          const isConnectedLecture = span > 1;
          if (isLectureDay || isConnectedLecture) {
            type = "core";
            labelType = "Lecture";
            subtitle = "Lecture";
          } else {
            type = "tutorial";
            labelType = "Tutorial";
            subtitle = "Tutorial";
          }
        }

        const baseEntry = {
          subject: slot.course_code + " " + (slot.course_name || ""),
          room: slot.section_number ? `Sec ${slot.section_number}` : "",
          type,
          labelType,
          subtitle,
          span,
        };

        for (let offset = 0; offset < span; offset += 1) {
          const targetIdx = (startIdx ?? -1) + offset;
          const targetLabel = TIMES[targetIdx] ?? label;
          if (!targetLabel) break;

          const cellEntry = {
            ...baseEntry,
            spanPart: span > 1 ? offset + 1 : null,
            spanTotal: span,
          };

          const cell = tableData[day][targetLabel];
          if (!cell) {
            tableData[day][targetLabel] = cellEntry;
          } else if (Array.isArray(cell)) {
            cell.push(cellEntry);
          } else {
            tableData[day][targetLabel] = [cell, cellEntry];
          }
        }
      }
      setScheduleData(tableData);
      setSlotList(normalizedSlots);
    } catch (err) {
      console.error("Load grid failed:", err);
      setScheduleData({});
      setSlotList([]);
    }
  };

  useEffect(() => {
    if (scheduleId) loadGrid(scheduleId);
    else {
      setScheduleData({});
      setSlotList([]);
    }
  }, [scheduleId]);

  useEffect(() => {
    if (!showEditor) return;
    const nextDraft = {};
    for (const slot of slotList) {
      const slotId = slot?.slot_id;
      if (slotId === undefined || slotId === null) continue;
      nextDraft[slotId] = {
        day: slot.day,
        start: slot.start,
        end: slot.end,
      };
    }
    setSlotEdits(nextDraft);
  }, [showEditor, slotList]);

  const refreshSchedules = useCallback(async () => {
    try {
      const { data } = await api.get("/list");
      const rows = data ?? [];
      setSchedules(rows);
      if (rows.length === 0) {
        updateActiveSchedule(null, false);
      } else {
        const current = scheduleIdRef.current;
        const preferred = rows.some((s) => s.ScheduleID === current)
          ? current
          : Number(rows[0].ScheduleID);
        updateActiveSchedule(preferred, false);
      }
    } catch (err) {
      console.error("Refresh schedules failed:", err);
    }
  }, [api, updateActiveSchedule]);

  const notifyScheduleChange = useCallback(() => {
    const current = scheduleIdRef.current;
    if (current === null || current === undefined) return;
    broadcastScheduleId(current);
  }, [broadcastScheduleId]);

  const openEditor = () => {
    if (!scheduleId) return;
    const currentSchedule = schedules.find((s) => s.ScheduleID === scheduleId);
    if (currentSchedule?.Status === "shared") return;
    setEditorMsg(null);
    setEditorError(null);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditorMsg(null);
    setEditorError(null);
    setSlotEdits({});
    setAddForm({ ...ADD_FORM_TEMPLATE });
  };

  const updateSlotDraft = (slotId, patch) => {
    setSlotEdits((prev) => ({
      ...prev,
      [slotId]: { ...prev[slotId], ...patch },
    }));
  };

  const updateAddForm = (patch) => {
    setAddForm((prev) => ({ ...prev, ...patch }));
  };

  const updateLecture = (patch) => {
    setAddForm((prev) => ({
      ...prev,
      lecture: { ...prev.lecture, ...patch },
    }));
  };

  const updateTutorial = (patch) => {
    setAddForm((prev) => ({
      ...prev,
      tutorial: { ...prev.tutorial, ...patch },
    }));
  };

  const updateLab = (patch) => {
    setAddForm((prev) => ({
      ...prev,
      lab: { ...prev.lab, ...patch },
    }));
  };

  const validateDraft = (draft) => {
    if (!draft) return "Missing slot data";
    if (!draft.day || !draft.start || !draft.end) {
      return "Day, start time, and end time are required";
    }
    if (timeToMinutes(draft.end) <= timeToMinutes(draft.start)) {
      return "End time must be after start time";
    }
    return null;
  };

  const saveSlot = async (slotId) => {
    if (!slotId) return;
    const draft = slotEdits[slotId];
    const slotData = slotList.find((slot) => slot.slot_id === slotId);
    if (!slotData) {
      setEditorError("Slot data unavailable");
      return;
    }

    const payload = {
      day: draft?.day ?? slotData?.day,
      start: draft?.start ?? slotData?.start,
      end: draft?.end ?? slotData?.end,
    };

    const validationError = validateDraft(payload);
    if (validationError) {
      setEditorError(validationError);
      return;
    }

    setEditorError(null);
    setSavingSlotId(slotId);
    try {
      await api.patch(`/slots/${slotId}`, payload);
      if (scheduleIdRef.current !== null && scheduleIdRef.current !== undefined) {
        await loadGrid(scheduleIdRef.current);
      }
      await refreshSchedules();
      notifyScheduleChange();
      setEditorMsg("Slot updated");
      setTimeout(() => setEditorMsg(null), 2000);
    } catch (err) {
      console.error("Update slot failed:", err);
      const apiMsg = err?.response?.data?.msg;
      setEditorError(apiMsg || "Failed to update slot");
    } finally {
      setSavingSlotId(null);
    }
  };

  const removeSlot = async (slotId) => {
    if (!slotId) return;
    setEditorError(null);
    setRemovingSlotId(slotId);
    try {
      await api.delete(`/slots/${slotId}`);
      if (scheduleIdRef.current !== null && scheduleIdRef.current !== undefined) {
        await loadGrid(scheduleIdRef.current);
      }
      await refreshSchedules();
      notifyScheduleChange();
      setEditorMsg("Slot removed");
      setTimeout(() => setEditorMsg(null), 2000);
    } catch (err) {
      console.error("Remove slot failed:", err);
      const apiMsg = err?.response?.data?.msg;
      setEditorError(apiMsg || "Failed to remove slot");
    } finally {
      setRemovingSlotId(null);
    }
  };

  const handleAddSlot = async () => {
    if (!scheduleIdRef.current) {
      setEditorError("No schedule selected");
      return;
    }

    const trimmedCode = addForm.courseCode.trim().toUpperCase();
    const trimmedName = addForm.courseName.trim();

    if (!trimmedCode || !trimmedName) {
      setEditorError("Course code and name are required");
      return;
    }

    const sectionRaw = addForm.sectionNumber?.trim() || "1";
    const baseSection = Number(sectionRaw);
    if (!sectionRaw || Number.isNaN(baseSection) || baseSection <= 0) {
      setEditorError("Section number must be a positive number");
      return;
    }

    const lectureDayValue = addForm.lecture.day;
    const lectureStart = addForm.lecture.start;
    const lectureEnd = addForm.lecture.end;

    if (!lectureDayValue) {
      setEditorError("Select lecture day");
      return;
    }
    if (!lectureStart || !lectureEnd) {
      setEditorError("Provide lecture start and end times");
      return;
    }
    if (timeToMinutes(lectureEnd) <= timeToMinutes(lectureStart)) {
      setEditorError("Lecture end time must be after start time");
      return;
    }

    const slots = [];
    const lectureDays =
      lectureDayValue === LECTURE_MULTI_DAY_VALUE
        ? LECTURE_MULTI_DAY_DAYS
        : [lectureDayValue];
    lectureDays.forEach((day) => {
      slots.push({
        sectionNumber: baseSection,
        day,
        start: lectureStart,
        end: lectureEnd,
      });
    });

    if (addForm.tutorial.enabled) {
      const { day, start, end } = addForm.tutorial;
      if (!day || !start || !end) {
        setEditorError("Provide tutorial day, start, and end time");
        return;
      }
      if (timeToMinutes(end) <= timeToMinutes(start)) {
        setEditorError("Tutorial end time must be after start time");
        return;
      }
      slots.push({
        sectionNumber: baseSection + 1,
        day,
        start,
        end,
      });
    }

    if (addForm.lab.enabled) {
      const { day, start, end } = addForm.lab;
      if (!day || !start || !end) {
        setEditorError("Provide lab day, start, and end time");
        return;
      }
      if (timeToMinutes(end) <= timeToMinutes(start)) {
        setEditorError("Lab end time must be after start time");
        return;
      }
      slots.push({
        sectionNumber: baseSection + 2,
        day,
        start,
        end,
      });
    }

    if (!slots.length) {
      setEditorError("At least one meeting is required");
      return;
    }

    const previousSettings = {
      lectureDay: lectureDayValue,
      tutorialEnabled: addForm.tutorial.enabled,
      tutorialDay: addForm.tutorial.day,
      labEnabled: addForm.lab.enabled,
      labDay: addForm.lab.day,
      isExternal: addForm.isExternal,
    };

    const capacityRaw = addForm.capacity?.trim();

    setEditorError(null);
    setAddingSlot(true);
    try {
      for (const slot of slots) {
        await api.post(`/slots`, {
          scheduleId: scheduleIdRef.current,
          courseCode: trimmedCode,
          courseName: trimmedName,
          sectionNumber: String(slot.sectionNumber),
          capacity: capacityRaw || undefined,
          day: slot.day,
          start: slot.start,
          end: slot.end,
          isExternal: addForm.isExternal,
        });
      }
      await loadGrid(scheduleIdRef.current);
      await refreshSchedules();
      notifyScheduleChange();
      setAddForm({
        ...ADD_FORM_TEMPLATE,
        isExternal: previousSettings.isExternal,
        lecture: {
          ...ADD_FORM_TEMPLATE.lecture,
          day: previousSettings.lectureDay,
        },
        tutorial: {
          ...ADD_FORM_TEMPLATE.tutorial,
          enabled: previousSettings.tutorialEnabled,
          day: previousSettings.tutorialEnabled
            ? previousSettings.tutorialDay
            : ADD_FORM_TEMPLATE.tutorial.day,
        },
        lab: {
          ...ADD_FORM_TEMPLATE.lab,
          enabled: previousSettings.labEnabled,
          day: previousSettings.labEnabled
            ? previousSettings.labDay
            : ADD_FORM_TEMPLATE.lab.day,
        },
      });
      setEditorMsg("Course added to schedule");
      setTimeout(() => setEditorMsg(null), 2000);
    } catch (err) {
      console.error("Add slot failed:", err);
      const apiMsg = err?.response?.data?.msg;
      setEditorError(apiMsg || "Failed to add course");
    } finally {
      setAddingSlot(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (evt) => {
      const incoming = evt.detail === null || evt.detail === undefined ? null : Number(evt.detail);
      const normalized = Number.isNaN(incoming) ? null : incoming;
      if (normalized === scheduleIdRef.current) return;
      updateActiveSchedule(normalized, false);
      refreshSchedules().catch((err) =>
        console.error("Refresh after schedule change failed:", err)
      );
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [refreshSchedules, updateActiveSchedule]);

  const generate = async () => {
    if (!scheduleId) return;
    setBusy(true);
    try {
      await api.post(`/generate/${scheduleId}`);
      await loadGrid(scheduleId);
      setMsg("✅ Schedule generated.");
      setTimeout(() => setMsg(null), 2000);
      await refreshSchedules();
    } finally {
      setBusy(false);
    }
  };

  const activeSchedule = schedules.find((s) => s.ScheduleID === scheduleId) ?? null;
  const status = activeSchedule?.Status ?? null;
  const locked = status === "approved";
  const editDisabled = !scheduleId || locked;
  const generateDisabled = busy || !scheduleId || locked;
  const showApprove =
    Boolean(scheduleId) && (status === "generated" || status === "shared");
  const baseSectionNumber = Number(addForm.sectionNumber);
  const hasBaseSection = !!addForm.sectionNumber && !Number.isNaN(baseSectionNumber);

  const approve = async () => {
    if (!scheduleId) return;
    setApproving(true);
    setMsg(null);
    try {
      await api.post(`/approve/${scheduleId}`);
      await loadGrid(scheduleId);
      await refreshSchedules();
      notifyScheduleChange();
      setMsg("✅ Schedule approved.");
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      console.error("Approve schedule failed:", err);
      const apiMsg = err?.response?.data?.msg;
      setMsg(apiMsg ? `⚠️ ${apiMsg}` : "⚠️ Failed to approve schedule");
    } finally {
      setApproving(false);
    }
  };
  return (
    <Container className="my-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <Nav
          variant="pills"
          className="schedule-tabs flex-wrap"
          activeKey={scheduleId !== null ? String(scheduleId) : undefined}
          onSelect={(key) => {
            const next = key ? Number(key) : null;
            updateActiveSchedule(next, true);
          }}
        >
          {schedules.map((s) => (
            <Nav.Item key={s.ScheduleID}>
              <Nav.Link eventKey={String(s.ScheduleID)}>
                Level {s.Level ?? "?"}
                {typeof s.GroupNo === "number" ? ` (#${s.GroupNo})` : ""}
                {s.IsIrregular ? " • Irregular" : ""}
                {` • ${s.Status}`}
              </Nav.Link>
            </Nav.Item>
          ))}
          {schedules.length === 0 && !loadingList && (
            <Nav.Item>
              <Nav.Link disabled>No schedules yet</Nav.Link>
            </Nav.Item>
          )}
        </Nav>
      </div>

      <style>{`
        .table-fixed { table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 5px; }
        th, td { text-align: center; vertical-align: middle; height: 70px; border: 1px solid #dee2e6; border-radius: 10px; padding: 0; overflow: hidden; }
        .subject-box { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; }
        .room { font-size: 0.75rem; color: #333; }
        .legend-box { display: inline-flex; align-items: center; margin: 0 10px; }
        .legend-color { width: 18px; height: 18px; border-radius: 4px; margin-right: 6px; border: 1px solid #ccc; }
        .btn-feedback { background-image: linear-gradient(135deg, #1c7ed6 0%, #3a3ddb 60%, #6526ff 100%); border: none; border-radius: 30px; padding: 14px 40px; font-weight: 600; font-size: 1.05rem; color: #fff; box-shadow: 0 12px 25px rgba(41, 74, 155, 0.25); transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .btn-feedback:hover { transform: translateY(-1px); box-shadow: 0 16px 28px rgba(41, 74, 155, 0.3); }
        .schedule-tabs .nav-link { border: none; color: #0b2339; background: #f1f3f5; border-radius: 999px; margin: 0 6px 8px 0; padding: 0.55rem 1.4rem; font-weight: 600; letter-spacing: 0.01em; transition: all 0.2s ease; box-shadow: inset 0 0 0 1px rgba(11,35,57,0.06); }
        .schedule-tabs .nav-link:hover { background: #e1e8f5; color: #0b2339; box-shadow: inset 0 0 0 1px rgba(11,35,57,0.12); }
        .schedule-tabs .nav-link.active { background: linear-gradient(135deg, #1c7ed6 0%, #3a3ddb 60%, #6526ff 100%); color: #fff; box-shadow: 0 8px 18px rgba(41, 74, 155, 0.25); }
        .schedule-tabs .nav-link.active:hover { color: #fff; }
      `}</style>

      <h2 className="text-center mb-2">Schedule</h2>
      {loadingList && (
        <div className="text-center text-muted mb-2">
          <Spinner animation="border" size="sm" className="me-2" /> Loading schedules...
        </div>
      )}
      {activeSchedule && (
        <div className="text-center text-muted mb-2">
          Level {activeSchedule.Level ?? "—"} • {activeSchedule.Status}
        </div>
      )}
      {activeSchedule?.IrregularNote && (
        <Alert variant="warning" className="text-center py-2">
          {activeSchedule.IrregularNote}
        </Alert>
      )}
      {!scheduleId && !loadingList && (
        <Alert variant="secondary" className="text-center">
          No schedule selected. Add course data to begin planning.
        </Alert>
      )}
      {scheduleId && status === "shared" && (
        <Alert variant="secondary" className="text-center">
          This schedule has been shared. You can continue editing until it is approved.
        </Alert>
      )}
      {scheduleId && status === "approved" && (
        <Alert variant="secondary" className="text-center">
          This schedule is approved and locked for changes.
        </Alert>
      )}
      {msg && <Alert variant="info">{msg}</Alert>}
      <div className="mb-3" />

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
                const slot = scheduleData[day]?.[time];
                if (!slot) return <td key={day}></td>;

                const entries = Array.isArray(slot) ? slot : [slot];

                return (
                  <td key={day}>
                    {entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="subject-box mb-1"
                        style={{
                          backgroundColor: colorOf(entry.type),
                          borderRadius: "10px",
                          padding: "10px 8px",
                          color: "#0b2339",
                          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
                          opacity: entry.spanTotal > 1 && entry.spanPart > 1 ? 0.9 : 1,
                        }}
                      >
                        <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          {entry.subtitle}
                          {entry.spanTotal > 1 ? ` • Part ${entry.spanPart}/${entry.spanTotal}` : ""}
                        </div>
                        <div>{entry.subject}</div>
                        {entry.room && <div className="room">{entry.room}</div>}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-center mt-4 d-flex flex-wrap justify-content-center gap-2">
        {!locked && (
          <Button
            className="btn-feedback"
            onClick={openEditor}
            disabled={editDisabled}
            title={!scheduleId ? "No schedule selected" : undefined}
          >
            Edit Schedule
          </Button>
        )}
        {!locked && (
          <Button
            className="btn-feedback"
            onClick={generate}
            disabled={generateDisabled}
            title={!scheduleId ? "No schedule selected" : undefined}
          >
            {busy
              ? "Generating..."
              : !scheduleId
              ? "No schedule"
              : "Generate / Refresh"}
          </Button>
        )}
        {showApprove && (
          <Button
            className="btn-feedback"
            style={{ backgroundImage: "linear-gradient(135deg, #40c057 0%, #2f9e44 100%)", color: "#fff" }}
            onClick={approve}
            disabled={approving}
          >
            {approving ? "Approving..." : "Approve"}
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="d-flex justify-content-center mt-3">
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div> Core</div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.tutorial }}></div> Tutorial</div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div> Lab</div>
      </div>

      <Modal show={showEditor} onHide={closeEditor} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Schedule</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editorError && <Alert variant="danger">{editorError}</Alert>}
          {editorMsg && <Alert variant="success">{editorMsg}</Alert>}

          <h5 className="mt-2">Scheduled Slots</h5>
          {slotList.length === 0 ? (
            <Alert variant="info" className="mt-3">
              No slots scheduled yet.
            </Alert>
          ) : (
            <div className="table-responsive mt-3">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Section</th>
                    <th>Type</th>
                    <th>Day</th>
                    <th>Start</th>
                    <th>End</th>
                    <th style={{ width: "160px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slotList.map((slot, index) => {
                    const slotId = slot?.slot_id ?? null;
                    const draft = slotId ? slotEdits[slotId] : null;
                    const dayValue = draft?.day ?? slot.day ?? DAYS[0];
                    const startValue = draft?.start ?? slot.start ?? "";
                    const endValue = draft?.end ?? slot.end ?? "";
                    const isLocked = slotId === null || slotId === undefined;
                    const saving = savingSlotId === slotId;
                    const removing = removingSlotId === slotId;
                    const key = slotId ?? `slot-${index}`;

                    return (
                      <tr key={key}>
                        <td>
                          <div className="fw-semibold">{slot.course_code}</div>
                          {slot.course_name && (
                            <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                              {slot.course_name}
                            </div>
                          )}
                        </td>
                        <td>{slot.section_number ?? "—"}</td>
                        <td>{slot.is_external ? "External" : "Internal"}</td>
                        <td>
                          <Form.Select
                            value={dayValue}
                            onChange={(e) => {
                              if (isLocked) return;
                              updateSlotDraft(slotId, { day: e.target.value });
                            }}
                            disabled={isLocked || saving || removing}
                          >
                            {DAYS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </Form.Select>
                        </td>
                        <td>
                          <Form.Control
                            type="time"
                            value={startValue}
                            onChange={(e) => {
                              if (isLocked) return;
                              updateSlotDraft(slotId, { start: e.target.value });
                            }}
                            disabled={isLocked || saving || removing}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="time"
                            value={endValue}
                            onChange={(e) => {
                              if (isLocked) return;
                              updateSlotDraft(slotId, { end: e.target.value });
                            }}
                            disabled={isLocked || saving || removing}
                          />
                        </td>
                        <td className="text-nowrap">
                          <Button
                            variant="primary"
                            size="sm"
                            className="me-2"
                            onClick={() => saveSlot(slotId)}
                            disabled={isLocked || saving || removing}
                          >
                            {saving ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeSlot(slotId)}
                            disabled={isLocked || removing || saving}
                          >
                            {removing ? "Removing..." : "Remove"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h5 className="mt-4">Add Course Slot</h5>
          <Form
            className="mt-3"
            onSubmit={(evt) => {
              evt.preventDefault();
              handleAddSlot();
            }}
          >
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label>Course Code</Form.Label>
                <Form.Control
                  placeholder="e.g., CSC381"
                  value={addForm.courseCode}
                  onChange={(e) => updateAddForm({ courseCode: e.target.value })}
                />
              </Col>
              <Col md={5}>
                <Form.Label>Course Name</Form.Label>
                <Form.Control
                  placeholder="Course name"
                  value={addForm.courseName}
                  onChange={(e) => updateAddForm({ courseName: e.target.value })}
                />
              </Col>
              <Col md={2}>
                <Form.Label>Section #</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={addForm.sectionNumber}
                  onChange={(e) => updateAddForm({ sectionNumber: e.target.value })}
                />
              </Col>
              <Col md={2}>
                <Form.Label>Capacity</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={addForm.capacity}
                  onChange={(e) => updateAddForm({ capacity: e.target.value })}
                />
              </Col>
            </Row>

            <div className="d-flex align-items-center gap-2 mt-2">
              <Form.Check
                type="switch"
                id="add-slot-is-external"
                label={addForm.isExternal ? "External course" : "Internal course"}
                checked={addForm.isExternal}
                onChange={(e) => updateAddForm({ isExternal: e.target.checked })}
              />
            </div>

            <div className="mt-4">
              <h6 className="fw-semibold">Lecture (required)</h6>
              <Row className="g-3 align-items-end">
                <Col md={3}>
                  <Form.Label>Day</Form.Label>
                  <Form.Select
                    value={addForm.lecture.day}
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
                    value={addForm.lecture.start}
                    onChange={(e) => updateLecture({ start: e.target.value })}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label>End</Form.Label>
                  <Form.Control
                    type="time"
                    value={addForm.lecture.end}
                    onChange={(e) => updateLecture({ end: e.target.value })}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label>Section</Form.Label>
                  <Form.Control value={hasBaseSection ? baseSectionNumber : ""} readOnly />
                </Col>
              </Row>
            </div>

            <div className="mt-4">
              <div className="d-flex align-items-center gap-2">
                <h6 className="fw-semibold mb-0">Tutorial (optional)</h6>
                <Form.Check
                  type="switch"
                  id="add-slot-tutorial"
                  label={addForm.tutorial.enabled ? "Enabled" : "Disabled"}
                  checked={addForm.tutorial.enabled}
                  onChange={(e) => updateTutorial({ enabled: e.target.checked })}
                />
              </div>
              {addForm.tutorial.enabled && (
                <Row className="g-3 align-items-end mt-2">
                  <Col md={3}>
                    <Form.Label>Day</Form.Label>
                    <Form.Select
                      value={addForm.tutorial.day}
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
                      value={addForm.tutorial.start}
                      onChange={(e) => updateTutorial({ start: e.target.value })}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>End</Form.Label>
                    <Form.Control
                      type="time"
                      value={addForm.tutorial.end}
                      onChange={(e) => updateTutorial({ end: e.target.value })}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Section</Form.Label>
                    <Form.Control
                      value={hasBaseSection ? baseSectionNumber + 1 : ""}
                      readOnly
                    />
                  </Col>
                </Row>
              )}
            </div>

            <div className="mt-4">
              <div className="d-flex align-items-center gap-2">
                <h6 className="fw-semibold mb-0">Lab (optional)</h6>
                <Form.Check
                  type="switch"
                  id="add-slot-lab"
                  label={addForm.lab.enabled ? "Enabled" : "Disabled"}
                  checked={addForm.lab.enabled}
                  onChange={(e) => updateLab({ enabled: e.target.checked })}
                />
              </div>
              {addForm.lab.enabled && (
                <Row className="g-3 align-items-end mt-2">
                  <Col md={3}>
                    <Form.Label>Day</Form.Label>
                    <Form.Select
                      value={addForm.lab.day}
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
                      value={addForm.lab.start}
                      onChange={(e) => updateLab({ start: e.target.value })}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>End</Form.Label>
                    <Form.Control
                      type="time"
                      value={addForm.lab.end}
                      onChange={(e) => updateLab({ end: e.target.value })}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Section</Form.Label>
                    <Form.Control
                      value={hasBaseSection ? baseSectionNumber + 2 : ""}
                      readOnly
                    />
                  </Col>
                </Row>
              )}
            </div>

            <div className="mt-4 text-end">
              <Button type="submit" disabled={addingSlot || editDisabled}>
                {addingSlot ? "Saving..." : "Save Course"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}
