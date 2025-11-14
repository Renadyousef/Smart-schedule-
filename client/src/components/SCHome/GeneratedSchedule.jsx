import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { Container, Spinner, Alert, Button, Nav, Modal, Form, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer"; // ✅ تمّت الإضافة
import supabase from "../../supabaseClient";
import {
  getScheduleCommentsArray,
  getScheduleListArray,
  getScheduleGridArray,
  getScheduleDraftMap,
  getSchedulePresenceMap,
  ySchedule,
} from "../../collab/yjsClient";

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
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const fallback = axios.create({ baseURL: API_BASE });
const http = API || fallback;
const CLIENT_ID_KEY = "sc.collabClientId";
const ACTIVE_PRESENCE_WINDOW = 15000;

const getActorName = () => {
  if (typeof window === "undefined") return "Committee member";
  return (
    window.localStorage.getItem("fullName") ||
    window.localStorage.getItem("name") ||
    window.localStorage.getItem("email") ||
    "Committee member"
  );
};

const getClientId = () => {
  if (typeof window === "undefined") {
    return `ss-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const generated =
    globalThis.crypto?.randomUUID?.() ||
    `client-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  window.localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
};

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

const scheduleListShared = getScheduleListArray();
const scheduleCommentsShared = getScheduleCommentsArray();

const toPlainArray = (yArray) =>
  yArray
    .toArray()
    .map((entry) => (entry && typeof entry.toJSON === "function" ? entry.toJSON() : entry));

const toPlainMap = (yMap) => {
  if (!yMap) return {};
  const entries = {};
  yMap.forEach((value, key) => {
    entries[key] = value && typeof value.toJSON === "function" ? value.toJSON() : value;
  });
  return entries;
};

const getSharedScheduleSnapshot = () => toPlainArray(scheduleListShared);
const getSharedCommentsSnapshot = () =>
  toPlainArray(scheduleCommentsShared).sort((a, b) => {
    const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });

const replaceArrayContents = (yArray, values) => {
  if (!yArray) return;
  if (yArray.length) {
    yArray.delete(0, yArray.length);
  }
  if (Array.isArray(values) && values.length) {
    yArray.push(values);
  }
};

const formatTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

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

const buildScheduleTable = (slots = []) => {
  const normalizedSlots = Array.isArray(slots) ? slots : [];
  const tableData = {};
  const baseSectionByCourse = {};

  for (const slot of normalizedSlots) {
    if (slot?.is_external && slot.course_code) {
      const sectionNum = Number(slot.section_number);
      if (Number.isFinite(sectionNum)) {
        const existing = baseSectionByCourse[slot.course_code];
        baseSectionByCourse[slot.course_code] =
          existing === undefined ? sectionNum : Math.min(existing, sectionNum);
      }
    }
  }

  for (const slot of normalizedSlots) {
    if (!slot) continue;
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

    const durationMinutes = Math.max(timeToMinutes(slot.end) - timeToMinutes(slot.start), 0);
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

  return tableData;
};

export default function GeneratedSchedule() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState(() => getSharedScheduleSnapshot());
  const [scheduleId, setScheduleId] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? null : parsed;
  });
  const scheduleIdRef = useRef(scheduleId);
  const [slotList, setSlotList] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [slotEdits, setSlotEditsState] = useState({});
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
  const [comments, setComments] = useState(() => getSharedCommentsSnapshot());
  const [newComment, setNewComment] = useState("");
  const [sharedMeta, setSharedMeta] = useState(() => ({
    updatedAt: ySchedule.get("lastUpdatedAt") || null,
    updatedBy: ySchedule.get("lastUpdatedBy") || null,
  }));
  const [presence, setPresence] = useState({});
  const [clientId] = useState(() => getClientId());
  const [actorName, setActorName] = useState(() => getActorName());
  const scheduleData = useMemo(() => buildScheduleTable(slotList), [slotList]);
  const activeCollaborators = useMemo(() => {
    const now = Date.now();
    const entries = Object.values(presence || {});
    return entries.filter((entry) => {
      if (!entry) return false;
      if (!entry.lastSeen) return true;
      const ts = new Date(entry.lastSeen).getTime();
      if (!Number.isFinite(ts)) return false;
      return now - ts < ACTIVE_PRESENCE_WINDOW;
    });
  }, [presence]);
  const collaboratorBadges = useMemo(
    () =>
      activeCollaborators.map((entry) => ({
        id: entry?.id || entry?.name || `${entry?.scheduleId || "collab"}`,
        label: entry?.id === clientId ? "You" : entry?.name || "Member",
      })),
    [activeCollaborators, clientId]
  );

  useEffect(() => {
    setActorName(getActorName());
  }, []);

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

  const syncSchedulesFromShared = useCallback(
    (rows = []) => {
      setSchedules(rows);
      if (!rows.length) {
        updateActiveSchedule(null, false);
        return;
      }
      const current = scheduleIdRef.current;
      const preferred = rows.some((s) => s.ScheduleID === current)
        ? current
        : Number(rows[0].ScheduleID);
      updateActiveSchedule(preferred, false);
    },
    [updateActiveSchedule]
  );

  useEffect(() => {
    const handleListChange = () => {
      syncSchedulesFromShared(getSharedScheduleSnapshot());
    };
    const handleCommentsChange = () => {
      setComments(getSharedCommentsSnapshot());
    };

    handleListChange();
    handleCommentsChange();

    scheduleListShared.observe(handleListChange);
    scheduleCommentsShared.observe(handleCommentsChange);

    return () => {
      scheduleListShared.unobserve(handleListChange);
      scheduleCommentsShared.unobserve(handleCommentsChange);
    };
  }, [syncSchedulesFromShared]);

  useEffect(() => {
    const observer = (event) => {
      if (
        event.keysChanged.has("lastUpdatedAt") ||
        event.keysChanged.has("lastUpdatedBy")
      ) {
        setSharedMeta({
          updatedAt: ySchedule.get("lastUpdatedAt") || null,
          updatedBy: ySchedule.get("lastUpdatedBy") || null,
        });
      }
    };
    ySchedule.observe(observer);
    return () => ySchedule.unobserve(observer);
  }, []);

  const loadSchedules = useCallback(async () => {
    const requestVersion = Date.now();
    setLoadingList(true);
    try {
      let { data } = await http.get("/schedule/list", withAuth());
      let rows = data ?? [];

      if (!rows.length) {
        try {
          const { data: created } = await http.post(
            "/schedule/init",
            null,
            withAuth()
          );
          if (created?.scheduleId) {
            const refreshed = await http.get("/schedule/list", withAuth());
            rows = refreshed.data ?? [];
          }
        } catch (err) {
          console.error("Init schedule on empty list failed:", err);
        }
      }

      const currentVersion = ySchedule.get("listVersion") || 0;
      if (requestVersion < currentVersion) {
        return;
      }

      replaceArrayContents(scheduleListShared, rows);
      ySchedule.set("listVersion", requestVersion);
      const actor =
        typeof window === "undefined"
          ? "System"
          : window.localStorage.getItem("fullName") ||
            window.localStorage.getItem("email") ||
            "Committee member";
      ySchedule.set("lastUpdatedAt", new Date().toISOString());
      ySchedule.set("lastUpdatedBy", actor);
      syncSchedulesFromShared(rows);
    } catch (err) {
      console.error("Fetch schedules failed:", err);
    } finally {
      setLoadingList(false);
    }
  }, [syncSchedulesFromShared]);

  useEffect(() => {
    loadSchedules();
    const channel = supabase
      .channel("generated-schedules-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Schedule" },
        () => {
          loadSchedules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSchedules]);

  const loadGrid = async (id) => {
    if (!id) {
      setSlotList([]);
      return;
    }
    try {
      const { data } = await http.get(
        `/schedule/grid/${id}`,
        withAuth()
      );
      const normalizedSlots = (data ?? []).map((slot) => ({
        ...slot,
        start: slot.start ? slot.start.slice(0, 5) : "",
        end: slot.end ? slot.end.slice(0, 5) : "",
      }));
      const sharedGrid = getScheduleGridArray(id);
      replaceArrayContents(sharedGrid, normalizedSlots);
    } catch (err) {
      console.error("Load grid failed:", err);
      const sharedGrid = getScheduleGridArray(id);
      replaceArrayContents(sharedGrid, []);
      setSlotList([]);
    }
  };

  useEffect(() => {
    if (!scheduleId) {
      return;
    }
    loadGrid(scheduleId);
  }, [scheduleId]);

  useEffect(() => {
    if (!scheduleId) {
      setSlotList([]);
      return undefined;
    }
    const sharedGrid = getScheduleGridArray(scheduleId);
    const syncGrid = () => {
      setSlotList(toPlainArray(sharedGrid));
    };
    syncGrid();
    const observer = () => syncGrid();
    sharedGrid.observe(observer);
    return () => {
      sharedGrid.unobserve(observer);
    };
  }, [scheduleId]);

  useEffect(() => {
    const draftMap = getScheduleDraftMap(scheduleId);
    if (!draftMap) {
      setSlotEditsState({});
      return undefined;
    }
    const syncDrafts = () => {
      setSlotEditsState(toPlainMap(draftMap));
    };
    syncDrafts();
    const observer = () => syncDrafts();
    draftMap.observe(observer);
    return () => {
      draftMap.unobserve(observer);
    };
  }, [scheduleId]);

  useEffect(() => {
    if (!scheduleId) return;
    const draftMap = getScheduleDraftMap(scheduleId);
    if (!draftMap) return;
    const slotKeys = new Set();
    slotList.forEach((slot) => {
      const slotId = slot?.slot_id;
      if (slotId === undefined || slotId === null) return;
      const key = String(slotId);
      slotKeys.add(key);
      if (!draftMap.has(key)) {
        draftMap.set(key, {
          slotId,
          scheduleId,
          day: slot.day,
          start: slot.start,
          end: slot.end,
        });
      }
    });
    draftMap.forEach((_value, key) => {
      if (!slotKeys.has(key)) {
        draftMap.delete(key);
      }
    });
  }, [scheduleId, slotList]);

  useEffect(() => {
    const presenceMap = getSchedulePresenceMap(scheduleId);
    if (!presenceMap) {
      setPresence({});
      return undefined;
    }
    const syncPresence = () => {
      setPresence(toPlainMap(presenceMap));
    };
    syncPresence();
    const observer = () => syncPresence();
    presenceMap.observe(observer);
    return () => {
      presenceMap.unobserve(observer);
    };
  }, [scheduleId]);

  useEffect(() => {
    if (!scheduleId || !showEditor) {
      const map = getSchedulePresenceMap(scheduleId);
      map?.delete?.(clientId);
      return undefined;
    }
    const presenceMap = getSchedulePresenceMap(scheduleId);
    if (!presenceMap) return undefined;
    const announce = () => {
      presenceMap.set(clientId, {
        id: clientId,
        name: actorName,
        scheduleId,
        lastSeen: new Date().toISOString(),
      });
    };
    announce();
    const heartbeat = setInterval(announce, 8000);
    return () => {
      clearInterval(heartbeat);
      presenceMap.delete(clientId);
    };
  }, [showEditor, scheduleId, clientId, actorName]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleBeforeUnload = () => {
      const map = getSchedulePresenceMap(scheduleIdRef.current);
      map?.delete?.(clientId);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [clientId]);

  const refreshSchedules = useCallback(async () => {
    await loadSchedules();
  }, [loadSchedules]);

  const notifyScheduleChange = useCallback(() => {
    const current = scheduleIdRef.current;
    if (current === null || current === undefined) return;
    broadcastScheduleId(current);
  }, [broadcastScheduleId]);

  const handleAddComment = useCallback(
    (event) => {
      event?.preventDefault?.();
      const text = newComment.trim();
      if (!text) return;
      const actor =
        actorName ||
        (typeof window === "undefined"
          ? "Committee member"
          : window.localStorage.getItem("fullName") ||
            window.localStorage.getItem("name") ||
            window.localStorage.getItem("email") ||
            "Committee member");
      const comment = {
        id:
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        text,
        author: actor,
        scheduleId: scheduleIdRef.current,
        createdAt: new Date().toISOString(),
      };
      scheduleCommentsShared.push([comment]);
      setNewComment("");
    },
    [newComment, actorName]
  );

  const handleRemoveComment = useCallback((commentId) => {
    const rawEntries = scheduleCommentsShared.toArray();
    const targetIndex = rawEntries.findIndex((entry) => {
      if (entry && typeof entry.get === "function") {
        return entry.get("id") === commentId;
      }
      return entry?.id === commentId;
    });
    if (targetIndex >= 0) {
      scheduleCommentsShared.delete(targetIndex, 1);
    }
  }, []);

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
    setAddForm({ ...ADD_FORM_TEMPLATE });
  };

  const updateSlotDraft = useCallback(
    (slotId, patch) => {
      if (!slotId) return;
      const draftMap = getScheduleDraftMap(scheduleIdRef.current);
      if (!draftMap) return;
      const key = String(slotId);
      const existing = draftMap.get(key);
      const base = existing && typeof existing.toJSON === "function" ? existing.toJSON() : existing;
      const fallbackSlot = slotList.find((slot) => slot.slot_id === slotId);
      const nextDraft = {
        slotId,
        scheduleId: scheduleIdRef.current,
        day: base?.day ?? fallbackSlot?.day ?? DAYS[0],
        start: base?.start ?? fallbackSlot?.start ?? "",
        end: base?.end ?? fallbackSlot?.end ?? "",
        updatedBy: actorName,
        updatedAt: new Date().toISOString(),
        ...patch,
      };
      draftMap.set(key, nextDraft);
      setSlotEditsState((prev) => ({
        ...prev,
        [slotId]: nextDraft,
      }));
    },
    [actorName, slotList]
  );

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
      await http.patch(
        `/schedule/slots/${slotId}`,
        payload,
        withAuth()
      );
      const draftMap = getScheduleDraftMap(scheduleIdRef.current);
      if (draftMap && scheduleIdRef.current !== null && scheduleIdRef.current !== undefined) {
        draftMap.set(String(slotId), {
          slotId,
          scheduleId: scheduleIdRef.current,
          ...payload,
          updatedBy: actorName,
          updatedAt: new Date().toISOString(),
        });
      }
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
      await http.delete(`/schedule/slots/${slotId}`, withAuth());
      const draftMap = getScheduleDraftMap(scheduleIdRef.current);
      draftMap?.delete?.(String(slotId));
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
        await http.post(
          "/schedule/slots",
          {
            scheduleId: scheduleIdRef.current,
            courseCode: trimmedCode,
            courseName: trimmedName,
            sectionNumber: String(slot.sectionNumber),
            capacity: capacityRaw || undefined,
            day: slot.day,
            start: slot.start,
            end: slot.end,
            isExternal: addForm.isExternal,
          },
          withAuth()
        );
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
      await http.post(
        `/schedule/generate/${scheduleId}`,
        null,
        withAuth()
      );
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
  const locked = status === "finalized";
  const editDisabled = !scheduleId || locked;
  const generateDisabled = busy || !scheduleId || locked;
  const showFinalize = Boolean(scheduleId) && status === "approved";
  const baseSectionNumber = Number(addForm.sectionNumber);
  const hasBaseSection = !!addForm.sectionNumber && !Number.isNaN(baseSectionNumber);

  const finalize = async () => {
    if (!scheduleId) return;
    setApproving(true);
    setMsg(null);
    try {
      await http.post(
        `/schedule/approve/${scheduleId}`,
        null,
        withAuth()
      );
      await loadGrid(scheduleId);
      await refreshSchedules();
      notifyScheduleChange();
      setMsg("✅ Schedule finalized.");
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      console.error("Finalize schedule failed:", err);
      const apiMsg = err?.response?.data?.msg;
      setMsg(apiMsg ? `⚠️ ${apiMsg}` : "⚠️ Failed to finalize schedule");
    } finally {
      setApproving(false);
    }
  };
  return (
    <Container className="my-4">
      <div className="d-flex justify-content-end mb-3">
        <Button variant="outline-secondary" onClick={() => navigate("/history")}>View History</Button>
      </div>
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
      {collaboratorBadges.length > 0 && (
        <Alert
          variant="info"
          className="d-flex flex-wrap gap-2 justify-content-center align-items-center mb-3"
        >
          <span className="fw-semibold mb-0">Live editors:</span>
          <div className="d-flex flex-wrap gap-2 mb-0">
            {collaboratorBadges.map((entry) => (
              <span key={entry.id} className="badge bg-primary text-light">
                {entry.label}
              </span>
            ))}
          </div>
        </Alert>
      )}
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
          This schedule has been shared. You can continue editing until it is finalized.
        </Alert>
      )}
      {scheduleId && status === "finalized" && (
        <Alert variant="secondary" className="text-center">
          This schedule is finalized and locked for changes.
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
        {showFinalize && (
          <Button
            className="btn-feedback"
            style={{ backgroundImage: "linear-gradient(135deg, #40c057 0%, #2f9e44 100%)", color: "#fff" }}
            onClick={finalize}
            disabled={approving}
          >
            {approving ? "Finalizing..." : "Finalize"}
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="d-flex justify-content-center mt-3">
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div> Core</div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.tutorial }}></div> Tutorial</div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div> Lab</div>
      </div>

      <div className="mt-4 bg-white rounded-4 shadow-sm p-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h5 className="mb-0">Shared Committee Notes</h5>
            <small className="text-muted">
              {sharedMeta.updatedAt
                ? `Last synced by ${sharedMeta.updatedBy || "—"} at ${formatTimestamp(sharedMeta.updatedAt)}`
                : "Realtime collaboration is active"}
            </small>
          </div>
          <small className="text-muted">Active schedule: {scheduleId ?? "—"}</small>
        </div>
        <Form className="d-flex gap-2 mb-3" onSubmit={handleAddComment}>
          <Form.Control
            placeholder="Share a note or decision with the committee"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button type="submit" disabled={!newComment.trim()}>
            Post
          </Button>
        </Form>
        <div className="list-group">
          {comments.length === 0 ? (
            <div className="list-group-item text-muted">No comments yet. Start the discussion.</div>
          ) : (
            [...comments]
              .sort((a, b) => {
                const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
              })
              .map((comment) => (
                <div
                  key={comment.id}
                  className="list-group-item d-flex justify-content-between align-items-start gap-3"
                >
                  <div>
                    <div className="fw-semibold">{comment.author || "Member"}</div>
                    <div>{comment.text}</div>
                    <small className="text-muted">
                      {comment.scheduleId ? `Schedule #${comment.scheduleId}` : "All schedules"}
                      {comment.createdAt ? ` • ${formatTimestamp(comment.createdAt)}` : ""}
                    </small>
                  </div>
                  <Button
                    size="sm"
                    variant="link"
                    className="text-danger p-0"
                    onClick={() => handleRemoveComment(comment.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))
          )}
        </div>
      </div>

      <Modal show={showEditor} onHide={closeEditor} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Schedule</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editorError && <Alert variant="danger">{editorError}</Alert>}
          {editorMsg && <Alert variant="success">{editorMsg}</Alert>}
          {collaboratorBadges.length > 0 && (
            <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
              <small className="text-muted">Live in this editor:</small>
              {collaboratorBadges.map((entry) => (
                <span key={`modal-${entry.id}`} className="badge bg-primary text-light">
                  {entry.label}
                </span>
              ))}
            </div>
          )}

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
                    const updatedAtTs = draft?.updatedAt
                      ? new Date(draft.updatedAt).getTime()
                      : null;
                    const recentlyEdited = updatedAtTs ? Date.now() - updatedAtTs < ACTIVE_PRESENCE_WINDOW : false;
                    const editedByOther = Boolean(
                      draft?.updatedBy && draft.updatedBy !== actorName && recentlyEdited
                    );
                    const rowClassName = editedByOther ? "table-warning" : undefined;

                    return (
                      <tr key={key} className={rowClassName}>
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
                          {editedByOther && (
                            <small className="text-muted d-block mt-1">
                              Editing now: {draft.updatedBy}
                            </small>
                          )}
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
