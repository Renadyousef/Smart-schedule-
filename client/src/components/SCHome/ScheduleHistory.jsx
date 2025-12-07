import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
  Alert,
} from "react-bootstrap";
import API from "../../API_continer";
import supabase from "../../supabaseClient";
import {
  getHistoryListArray,
  getHistorySnapshotsMap,
  ySchedule,
} from "../../collab/yjsClient";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const http = API || axios.create({ baseURL: API_BASE });

const historyListShared = getHistoryListArray();
const historySnapshotsShared = getHistorySnapshotsMap();

const toPlain = (value) => {
  if (!value) return value;
  return typeof value.toJSON === "function" ? value.toJSON() : value;
};

const arrayToPlain = (yArray) =>
  yArray
    .toArray()
    .map((entry) => toPlain(entry));

const replaceArrayContents = (yArray, values = []) => {
  if (!yArray) return;
  const length = yArray.length || 0;
  if (length) {
    yArray.delete(0, length);
  }
  if (Array.isArray(values) && values.length) {
    yArray.push(values);
  }
};

const getHistoryListSnapshot = () => arrayToPlain(historyListShared);

const getHistoryMetaSnapshot = () => {
  const metaValue = ySchedule.get("historyMeta");
  return toPlain(metaValue) || {};
};

const getHistoryDetailSnapshot = (historyId) => {
  if (!historyId) return null;
  const value = historySnapshotsShared.get(String(historyId));
  return toPlain(value) || null;
};

const LEGEND_ITEMS = [
  { key: "core", label: "Core / External" },
  { key: "tutorial", label: "Tutorial" },
  { key: "lab", label: "Lab" },
  { key: "elective", label: "Elective" },
];

const PALETTE = {
  core: "#cce5ff",
  tutorial: "#ffe0b2",
  lab: "#e1bee7",
  elective: "#fff9c4",
  default: "#f8f9fa",
};

const SLOT_LABELS = {
  core: "Lecture",
  tutorial: "Tutorial",
  lab: "Lab",
  elective: "Elective",
  default: "Class",
};

const STATUS_STYLES = {
  approved: { backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#15803d" },
  finalized: { backgroundColor: "rgba(56, 189, 248, 0.12)", color: "#0369a1" },
  shared: { backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#4338ca" },
  draft: { backgroundColor: "rgba(234, 179, 8, 0.12)", color: "#b45309" },
  pending: { backgroundColor: "rgba(234, 179, 8, 0.12)", color: "#b45309" },
  rejected: { backgroundColor: "rgba(248, 113, 113, 0.16)", color: "#b91c1c" },
  default: { backgroundColor: "rgba(148, 163, 184, 0.16)", color: "#475569" },
};

const historyStyles = `
  .table-fixed {
    table-layout: fixed;
    width: 100%;
    border-collapse: separate;
    border-spacing: 5px;
  }

  th,
  td {
    text-align: center;
    vertical-align: middle;
    height: 70px;
    border: 1px solid #dee2e6;
    border-radius: 10px;
    padding: 0;
    overflow: hidden;
  }

  .subject-box {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: 6px;
    padding: 8px 6px;
  }

  .room {
    font-size: 0.75rem;
    color: #333333;
  }

  .legend-box {
    display: inline-flex;
    align-items: center;
    margin: 0 10px 0 0;
  }

  .legend-color {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    margin-right: 6px;
    border: 1px solid #ccc;
  }

  .history-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  .history-version-list {
    max-height: 520px;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .history-version-btn {
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 0.85rem 1rem;
    background-color: #ffffff;
    color: #1e293b;
    transition: all 0.18s ease;
    width: 100%;
    text-align: left;
  }

  .history-version-btn:hover {
    transform: translateY(-1px);
    border-color: #cbd5f5;
    background-color: #f8fbff;
  }

  .history-version-btn.is-active {
    border-color: rgba(79, 70, 229, 0.5);
    background: linear-gradient(135deg, #1c7ed6 0%, #3a3ddb 55%, #6526ff 100%);
    color: #ffffff;
    box-shadow: 0 12px 26px -18px rgba(79, 70, 229, 0.6);
  }

  .history-version-btn.is-active .text-muted {
    color: rgba(255, 255, 255, 0.75) !important;
  }

  .history-status-chip {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 6px 12px;
    border-radius: 999px;
    font-weight: 700;
  }

  .history-meta-line {
    font-size: 0.82rem;
    color: #475569;
  }

  /* Responsive: allow horizontal scroll on small screens (like student schedule) */
  @media (max-width: 768px) {
    .table-fixed {
      display: block;
      overflow-x: auto;
      white-space: nowrap;
    }
    th,
    td {
      font-size: 0.75rem;
      height: 55px;
      padding: 2px;
    }
    .subject-box {
      font-size: 0.75rem;
      line-height: 1.1;
      padding: 4px;
    }
    .room {
      font-size: 0.65rem;
    }
  }

  @media (max-width: 390px) {
    .subject-box {
      font-size: 0.7rem;
    }
    th,
    td {
      font-size: 0.7rem;
      height: 50px;
    }
  }

  @media (max-width: 991px) {
    .history-version-list {
      max-height: initial;
      margin-bottom: 1.5rem;
    }
  }
`;

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

function toMinutes(time) {
  if (!time) return Number.POSITIVE_INFINITY;
  const [h = "0", m = "0"] = String(time).split(":");
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
}

function normalizeDay(day) {
  if (!day) return null;
  const lower = String(day).toLowerCase();
  const match = DAYS.find((item) => item.toLowerCase() === lower);
  return match ?? String(day);
}

function buildGrid(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.slots) || snapshot.slots.length === 0) {
    return { days: DAYS, rows: [] };
  }

  const rowsMap = new Map();

  snapshot.slots.forEach((slot) => {
    const day = normalizeDay(slot.day);
    const start = slot.start ?? "";
    const end = slot.end ?? "";
    const label = start && end ? `${start} - ${end}` : start || end || "—";
    if (!rowsMap.has(label)) {
      rowsMap.set(label, {
        label,
        startMinutes: toMinutes(start),
        cells: {},
      });
    }
    const row = rowsMap.get(label);
    const dayKey = day ?? "Other";
    if (!row.cells[dayKey]) {
      row.cells[dayKey] = [];
    }
    row.cells[dayKey].push(slot);
  });

  const rows = Array.from(rowsMap.values())
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((entry) => ({
      label: entry.label,
      cells: entry.cells,
    }));

  return { days: DAYS, rows };
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function resolveSlotVariant(slot) {
  if (!slot) return "default";

  const normalizedType = String(slot.type || slot.courseType || "")
    .toLowerCase()
    .trim();

  if (slot.isExternal) return "core";
  if (normalizedType.includes("lab")) return "lab";
  if (normalizedType.includes("tutorial") || normalizedType.includes("practical")) {
    return "tutorial";
  }
  if (normalizedType.includes("elective")) return "elective";
  if (normalizedType.includes("core") || normalizedType.includes("mandatory")) {
    return "core";
  }

  return "default";
}

function slotDisplay(slot) {
  const key = resolveSlotVariant(slot);
  const color = PALETTE[key] ?? PALETTE.default;
  const label = SLOT_LABELS[key] ?? SLOT_LABELS.default;
  return { key, color, label };
}

function statusVisual(status) {
  const key = String(status || "default").toLowerCase();
  return STATUS_STYLES[key] ?? STATUS_STYLES.default;
}

export default function ScheduleHistory() {
  const initialFilters = (() => {
    const stored = toPlain(ySchedule.get("historyFilters"));
    if (stored && typeof stored === "object") {
      return {
        level: stored.level ?? "",
        groupNo: stored.groupNo ?? "",
      };
    }
    return { level: "", groupNo: "" };
  })();

  const [filters, setFilters] = useState(initialFilters);
  const [historyItems, setHistoryItems] = useState(() => getHistoryListSnapshot());
  const [meta, setMeta] = useState(() => getHistoryMetaSnapshot());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const initialSelected = ySchedule.get("historySelectedId") || null;
  const [selectedId, setSelectedId] = useState(initialSelected);
  const selectedIdRef = useRef(initialSelected);
  const [detail, setDetail] = useState(() => getHistoryDetailSnapshot(initialSelected));
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {};
    if (filters.level) params.level = filters.level;
    if (filters.groupNo) params.groupNo = filters.groupNo;

    try {
      const { data } = await http.get(
        "/history",
        withAuth({ params })
      );
      const items = Array.isArray(data?.items) ? data.items : [];
      const metaPayload = data?.meta ?? {};
      setHistoryItems(items);
      setMeta(metaPayload);
      replaceArrayContents(historyListShared, items);
      ySchedule.set("historyMeta", metaPayload);

      if (items.length) {
        const currentSelected = selectedIdRef.current;
        const ensureId = currentSelected && items.some((item) => item.historyId === currentSelected)
          ? currentSelected
          : items[0].historyId;
        if (ensureId !== currentSelected) {
          selectedIdRef.current = ensureId;
          setSelectedId(ensureId);
        }
        const sharedSelected = ySchedule.get("historySelectedId") || null;
        if (sharedSelected !== ensureId) {
          ySchedule.set("historySelectedId", ensureId);
        }
      } else {
        selectedIdRef.current = null;
        setSelectedId(null);
        setDetail(null);
        ySchedule.set("historySelectedId", null);
      }
    } catch (err) {
      console.error("fetchHistory:", err);
      setError(err?.response?.data?.msg || "Failed to load history");
      setHistoryItems([]);
      setMeta({});
      replaceArrayContents(historyListShared, []);
      ySchedule.set("historyMeta", {});
    } finally {
      setLoading(false);
    }
  }, [filters.level, filters.groupNo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const handleListChange = () => {
      setHistoryItems(getHistoryListSnapshot());
    };
    historyListShared.observe(handleListChange);
    return () => {
      historyListShared.unobserve(handleListChange);
    };
  }, []);

  useEffect(() => {
    const handleSnapshotsChange = (event) => {
      if (!selectedIdRef.current) return;
      const key = String(selectedIdRef.current);
      if (event.keysChanged?.has?.(key)) {
        const snapshot = getHistoryDetailSnapshot(selectedIdRef.current);
        if (snapshot) {
          setDetail(snapshot);
          setDetailLoading(false);
        }
      }
    };
    historySnapshotsShared.observe(handleSnapshotsChange);
    return () => {
      historySnapshotsShared.unobserve(handleSnapshotsChange);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("schedule-history-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_history" },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHistory]);

  useEffect(() => {
    const observer = (event) => {
      if (event.keysChanged.has("historyMeta")) {
        setMeta(getHistoryMetaSnapshot());
      }
      if (event.keysChanged.has("historySelectedId")) {
        const sharedSelected = ySchedule.get("historySelectedId") || null;
        selectedIdRef.current = sharedSelected;
        setSelectedId(sharedSelected);
      }
      if (event.keysChanged.has("historyFilters")) {
        const sharedFilters = toPlain(ySchedule.get("historyFilters")) || { level: "", groupNo: "" };
        setFilters({
          level: sharedFilters.level ?? "",
          groupNo: sharedFilters.groupNo ?? "",
        });
      }
    };

    ySchedule.observe(observer);
    return () => {
      ySchedule.unobserve(observer);
    };
  }, []);

  useEffect(() => {
    const sharedFilters = toPlain(ySchedule.get("historyFilters")) || { level: "", groupNo: "" };
    if (
      (sharedFilters.level ?? "") !== filters.level ||
      (sharedFilters.groupNo ?? "") !== filters.groupNo
    ) {
      ySchedule.set("historyFilters", filters);
    }
  }, [filters]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    selectedIdRef.current = selectedId;
    setDetailLoading(true);
    setError(null);

    const cached = getHistoryDetailSnapshot(selectedId);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      return;
    }

    let isCurrent = true;

    http
      .get(`/history/${selectedId}`, withAuth())
      .then((response) => {
        if (!isCurrent) return;
        const payload = response.data ?? null;
        setDetail(payload);
        historySnapshotsShared.set(String(selectedId), payload);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error("loadHistoryDetail:", err);
        setError(err?.response?.data?.msg || "Failed to load history entry");
        setDetail(null);
      })
      .finally(() => {
        if (isCurrent) {
          setDetailLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedId]);

  const uniqueLevels = useMemo(() => {
    const values = new Set();
    historyItems.forEach((item) => {
      if (item.level !== null && item.level !== undefined) values.add(item.level);
    });
    return Array.from(values).sort((a, b) => a - b);
  }, [historyItems]);

  const availableGroups = useMemo(() => {
    const targetLevel = filters.level ? Number(filters.level) : null;
    const source = targetLevel
      ? historyItems.filter((item) => Number(item.level) === targetLevel)
      : historyItems;
    const values = new Set();
    source.forEach((item) => {
      if (item.groupNo !== null && item.groupNo !== undefined) values.add(item.groupNo);
    });
    return Array.from(values).sort((a, b) => a - b);
  }, [filters.level, historyItems]);

  useEffect(() => {
    if (filters.level && !availableGroups.includes(Number(filters.groupNo))) {
      setFilters((prev) => ({ ...prev, groupNo: "" }));
    }
  }, [availableGroups, filters.level, filters.groupNo]);

  const handleSelect = (historyId) => {
    selectedIdRef.current = historyId;
    setSelectedId(historyId);
    const sharedSelected = ySchedule.get("historySelectedId") || null;
    if (sharedSelected !== historyId) {
      ySchedule.set("historySelectedId", historyId);
    }
  };

  const detailSnapshot = detail?.history?.snapshot ?? null;
  const grid = useMemo(() => buildGrid(detailSnapshot), [detailSnapshot]);

  return (
    <>
      <style>{historyStyles}</style>
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h2 className="mb-1">Schedule History</h2>
            <div className="text-muted small">Explore saved schedule snapshots and revisit previous versions.</div>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={fetchHistory}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <Card className="mb-4">
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col md={4} sm={6} xs={12}>
                <Form.Label>Level</Form.Label>
                  <Form.Select
                    value={filters.level}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, level: event.target.value }))
                    }
                  >
                    <option value="">All levels</option>
                    {uniqueLevels.map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} sm={6} xs={12}>
                  <Form.Label>Group</Form.Label>
                  <Form.Select
                    value={filters.groupNo}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, groupNo: event.target.value }))
                    }
                    disabled={!availableGroups.length}
                  >
                    <option value="">All groups</option>
                    {availableGroups.map((group) => (
                      <option key={group} value={group}>
                        Group {group}
                 
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} sm={12} className="d-flex align-items-end">
                  <Button
                    variant="outline-secondary"
                    className="ms-auto"
                    onClick={() => setFilters({ level: "", groupNo: "" })}
                    disabled={!filters.level && !filters.groupNo}
                  >
                    Clear filters
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <Row className="g-4 align-items-start">
            <Col lg={4}>
              <Card className="h-100">
                <Card.Header>Versions</Card.Header>
                <Card.Body className="history-version-list d-flex flex-column gap-3">
                  {loading && (
                    <div className="d-flex align-items-center text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading history...
                    </div>
                  )}
                  {!loading && historyItems.length === 0 && (
                    <div className="text-muted">No history entries yet.</div>
                  )}
                  <div className="d-flex flex-column gap-2">
                    {historyItems.map((item) => {
                      const isActive = item.historyId === selectedId;
                      return (
                        <Button
                          key={item.historyId}
                          variant="light"
                          className={`history-version-btn text-start ${isActive ? "is-active" : ""}`}
                          onClick={() => handleSelect(item.historyId)}
                        >
                          <div className="fw-semibold">Version {item.versionNo}</div>
                          <div className="small text-muted">{formatDate(item.createdAt)}</div>
                          <div className="small">
                            Level {item.level ?? "—"}
                            {typeof item.groupNo === "number" ? ` • Group ${item.groupNo}` : ""}
                          </div>
                          {item.summary && (
                            <div className="small text-muted mt-1">{item.summary}</div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </Card.Body>
                {meta?.hasMore && (
                  <Card.Footer className="text-muted small py-3 px-4">
                    Showing first {meta.limit ?? historyItems.length} entries. Refine filters to narrow down.
                  </Card.Footer>
                )}
              </Card>
            </Col>
            <Col lg={8}>
              <Card className="h-100">
                <Card.Header>Snapshot</Card.Header>
                <Card.Body>
                  {detailLoading && (
                    <div className="d-flex align-items-center text-muted mb-3">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading snapshot...
                    </div>
                  )}

                  {!detailLoading && !detail && (
                    <div className="text-muted">Select a version to inspect its schedule.</div>
                  )}

                  {detail && (
                    <div className="d-flex flex-column gap-3">
                      <div className="border rounded-3 bg-white p-3 shadow-sm">
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                          <div>
                            <h4 className="mb-1">Version {detail.history.versionNo}</h4>
                            <div className="history-meta-line">
                              Captured {formatDate(detail.history.createdAt)} • Level {detail.history.level ?? "—"}
                              {typeof detail.history.groupNo === "number" ? ` • Group ${detail.history.groupNo}` : ""}
                              {typeof detail.history.slotCount === "number" ? ` • ${detail.history.slotCount} slots` : ""}
                            </div>
                          </div>
                          <span
                            className="history-status-chip"
                            style={statusVisual(detail.history.status)}
                          >
                            {(detail.history.status ?? "unknown").toString().toUpperCase()}
                          </span>
                        </div>
                        {detail.history.summary && (
                          <div className="mt-3">{detail.history.summary}</div>
                        )}
                        {detail.history.changeNote && (
                          <div className="mt-2 history-meta-line">Note: {detail.history.changeNote}</div>
                        )}
                      </div>

                      <div className="history-legend">
                        {LEGEND_ITEMS.map((item) => {
                          const color = PALETTE[item.key] ?? PALETTE.default;
                          return (
                            <div key={item.key} className="legend-box">
                              <span
                                className="legend-color"
                                style={{ backgroundColor: color }}
                              />
                              <span className="small text-muted">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="table-responsive">
                        <table className="table-fixed">
                          <thead>
                            <tr>
                              <th style={{ width: "150px", backgroundColor: "#f1f3f5" }}>Time</th>
                              {grid.days.map((day) => (
                                <th key={day} style={{ backgroundColor: "#f1f3f5" }}>{day}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {grid.rows.length === 0 && (
                              <tr>
                                <td colSpan={grid.days.length + 1} className="text-muted">
                                  No slots captured in this snapshot.
                                </td>
                              </tr>
                            )}
                            {grid.rows.map((row) => (
                              <tr key={row.label}>
                                <th scope="row" style={{ backgroundColor: "#f9fafb", fontSize: "0.9rem" }}>
                                  {row.label}
                                </th>
                                {grid.days.map((day) => {
                                  const entries = row.cells[day] || [];
                                  if (!entries.length) {
                                    return <td key={day}></td>;
                                  }

                                  return (
                                    <td key={day}>
                                      {entries.map((slot) => {
                                        const { label, color } = slotDisplay(slot);
                                        const courseCode = slot.courseCode || slot.course_code || "";
                                        const courseName = slot.courseName || slot.course_name || "";
                                        const subject = courseCode && courseName
                                          ? `${courseCode} — ${courseName}`
                                          : courseCode || courseName || "Course";

                                        const sectionNumber =
                                          slot.sectionNumber ?? slot.section_number ?? null;
                                        const sectionLabel =
                                          sectionNumber !== null && sectionNumber !== undefined
                                            ? `Sec ${sectionNumber}`
                                            : null;
                                        const roomLabel = slot.room || slot.location || null;
                                        const roomLine = [sectionLabel, roomLabel]
                                          .filter(Boolean)
                                          .join(" • ");

                                        const descriptorParts = [slot.isExternal ? "External" : "Internal"];
                                        const typeLabelRaw = slot.courseType || slot.type;
                                        if (typeLabelRaw) descriptorParts.push(typeLabelRaw);
                                        const instructor =
                                          slot.instructorName || slot.instructor || slot.facultyName || null;
                                        if (instructor) descriptorParts.push(instructor);
                                        if (slot.note) descriptorParts.push(slot.note);
                                        const detailLine = descriptorParts.filter(Boolean).join(" • ");

                                        const fallbackKey = [
                                          day,
                                          slot.courseId ?? courseCode ?? courseName ?? "course",
                                          slot.sectionId ?? sectionNumber ?? "section",
                                          slot.start ?? "start",
                                          slot.end ?? "end",
                                        ]
                                          .map((part) => String(part))
                                          .join("|");
                                        const keyValue = slot.slotId ?? fallbackKey;

                                        return (
                                          <div
                                            key={keyValue}
                                            className="subject-box mb-1"
                                            style={{
                                              backgroundColor: color,
                                              color: "#0b2339",
                                              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontSize: "0.65rem",
                                                fontWeight: 600,
                                                letterSpacing: "0.06em",
                                                textTransform: "uppercase",
                                              }}
                                            >
                                              {label}
                                            </div>
                                            <div>{subject}</div>
                                            {roomLine && <div className="room">{roomLine}</div>}
                                            {detailLine && (
                                              <div
                                                style={{
                                                  fontSize: "0.7rem",
                                                  color: "#475569",
                                                  marginTop: "4px",
                                                }}
                                              >
                                                {detailLine}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
    </>
  );
}
