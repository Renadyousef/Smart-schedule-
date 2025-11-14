// server/controllers/scheduleController.jss
import pool from "../../DataBase_config/DB_config.js";
import OpenAI from "openai";
import jwt from "jsonwebtoken";
import * as jsondiffpatch from "jsondiffpatch";

export function resolveUserId(req) {
  let userId =
    req.user?.id ??
    req.user?.UserID ??
    req.user?.userId ??
    req.user?.sub ??
    null;

  if (!userId) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (token) {
      const decoded = jwt.decode(token);
      userId =
        decoded?.id ??
        decoded?.UserID ??
        decoded?.userId ??
        decoded?.sub ??
        null;
    }
  }

  return userId;
}

async function nextGroupNo(client, scId, level) {
  if (level === null || level === undefined) return 1;
  const scopedId = scopeCommitteeFilter(scId) ?? null;
  const r = await client.query(
    `SELECT COALESCE(MAX("GroupNo"), 0) + 1 AS "next"
       FROM "Schedule"
      WHERE ($1::int IS NULL OR "SchedulingCommitteeID"=$1)
        AND ($2::int IS NULL OR "Level"=$2)`,
    [scopedId, level]
  );
  return r.rows[0]?.next ?? 1;
}

const THREE_LECTURE_DAYS = ["Sunday", "Tuesday", "Thursday"];

const GROUP_A_COURSES = new Set([
  "SWE211",
  "SWE314",
  "SWE312",
  "SWE321",
  "SWE381",
  "SWE482",
  "SWE434",
  "SWE466",
]);

const GROUP_B_COURSES = new Set([
  "SWE455",
  "SWE333",
]);

const IRREGULAR_LEVELS = new Set([4, 6, 8]);

const SHARE_SCHEDULES_GLOBAL =
  (process.env.SHARE_SCHEDULES_GLOBALLY ?? "true").toLowerCase() !== "false";
export const isGlobalScheduleSharingEnabled = SHARE_SCHEDULES_GLOBAL;
export const scopeCommitteeFilter = (committeeId) =>
  SHARE_SCHEDULES_GLOBAL ? null : committeeId;

const DEFAULT_LECTURE_START = "08:00";
const DEFAULT_TUTORIAL_START = "10:00";
const VALID_DAYS = new Set(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]);

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_INDEX = new Map(DAY_NAMES.map((name, index) => [name.toLowerCase(), index]));

const diffPatcher = jsondiffpatch.create({
  arrays: { detectMove: false },
  objectHash(item) {
    if (!item || typeof item !== "object") {
      return JSON.stringify(item);
    }
    return (
      item.slotId ??
      item.sectionId ??
      item.courseId ??
      item.scheduleId ??
      item.id ??
      JSON.stringify(item)
    );
  },
});

function isUuid(value) {
  if (typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value.trim()
  );
}

function normalizeDayName(day) {
  if (!day) return null;
  const lower = String(day).toLowerCase();
  const match = DAY_NAMES.find((name) => name.toLowerCase() === lower);
  return match ?? null;
}

function shortenTime(value) {
  if (!value) return null;
  const str = String(value);
  if (str.length >= 5) return str.slice(0, 5);
  return str;
}

async function fetchScheduleSnapshot(db, scheduleId) {
  const scheduleRes = await db.query(
    `SELECT "ScheduleID"           AS "scheduleId",
            "SchedulingCommitteeID" AS "schedulingCommitteeId",
            "Status"                AS "status",
            "Level"                 AS "level",
            "GroupNo"               AS "groupNo"
       FROM "Schedule"
      WHERE "ScheduleID"=$1`,
    [scheduleId]
  );

  if (!scheduleRes.rowCount) {
    return null;
  }

  const slotsRes = await db.query(
    `SELECT s."SlotID"              AS "slotId",
            s."CourseID"            AS "courseId",
            s."DayOfWeek"           AS "day",
            s."StartTime"           AS "start",
            s."EndTime"             AS "end",
            c.course_code            AS "courseCode",
            c.course_name            AS "courseName",
            c.course_type            AS "courseType",
            c.level                  AS "courseLevel",
            c.is_external            AS "isExternal",
            sec."SectionID"         AS "sectionId",
            COALESCE(sec."SectionNumber",1) AS "sectionNumber",
            COALESCE(sec."Capacity",30)     AS "capacity",
            sec."InstructorID"      AS "instructorId",
            sec."Room"              AS "room"
       FROM "ScheduleSlot" s
       JOIN courses c ON c."CourseID"=s."CourseID"
       LEFT JOIN "Sections" sec ON sec."SlotID"=s."SlotID"
      WHERE s."ScheduleID"=$1
      ORDER BY s."DayOfWeek", s."StartTime", s."SlotID"`,
    [scheduleId]
  );

  const sectionsRes = await db.query(
    `SELECT "SectionID"        AS "sectionId",
            "ScheduleID"       AS "scheduleId",
            "CourseID"         AS "courseId",
            "SlotID"           AS "slotId",
            COALESCE("SectionNumber",1) AS "sectionNumber",
            COALESCE("Capacity",30)     AS "capacity",
            "InstructorID"     AS "instructorId",
            "Room"             AS "room"
       FROM "Sections"
      WHERE "ScheduleID"=$1
      ORDER BY "SectionID"`,
    [scheduleId]
  );

  const schedule = scheduleRes.rows[0];
  const slots = slotsRes.rows.map((slot) => ({
    ...slot,
    day: normalizeDayName(slot.day),
    start: shortenTime(slot.start),
    end: shortenTime(slot.end),
  }));

  return {
    schedule,
    slots,
    sections: sectionsRes.rows,
  };
}

async function recordScheduleHistory({
  db,
  scheduleId,
  userId = null,
  summary = null,
  changeNote = null,
}) {
  const client = db ?? pool;
  const snapshot = await fetchScheduleSnapshot(client, scheduleId);
  if (!snapshot) return null;

  const previousRes = await client.query(
    `SELECT version_no AS "versionNo", snapshot
       FROM schedule_history
      WHERE schedule_id=$1
      ORDER BY version_no DESC
      LIMIT 1`,
    [scheduleId]
  );

  const previous = previousRes.rowCount ? previousRes.rows[0] : null;
  const versionNo = (previous?.versionNo ?? 0) + 1;

  let diff = null;
  if (previous?.snapshot) {
    diff = diffPatcher.diff(previous.snapshot, snapshot) ?? null;
    if (diff && Object.keys(diff).length === 0) {
      diff = null;
    }
  }

  const slotCount = Array.isArray(snapshot.slots) ? snapshot.slots.length : 0;
  const summaryText = summary ?? (versionNo === 1 ? "Initial snapshot" : "Schedule updated");
  const changedBy = isUuid(userId) ? userId.trim() : null;

  await client.query(
    `INSERT INTO schedule_history
       (schedule_id, version_no, snapshot, diff, summary, status, level, group_no, slot_count, changed_by, change_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      scheduleId,
      versionNo,
      snapshot,
      diff,
      summaryText,
      snapshot.schedule?.status ?? null,
      snapshot.schedule?.level ?? null,
      snapshot.schedule?.groupNo ?? null,
      slotCount,
      changedBy,
      changeNote ?? null,
    ]
  );

  return { versionNo, diff };
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function splitConnectedBlocks(day, startHour, startMinute, type, hours) {
  const slots = [];
  for (let i = 0; i < hours; i += 1) {
    const blockStartHour = startHour + i;
    const minuteWithOffset = startMinute + i * 60;
    const normalizedStartHour = startHour + Math.floor(minuteWithOffset / 60);
    const normalizedStartMinute = minuteWithOffset % 60;
    const start = formatTime(normalizedStartHour, normalizedStartMinute);

    const endMinutesTotal = normalizedStartMinute + 50;
    const endHour = normalizedStartHour + Math.floor(endMinutesTotal / 60);
    const endMinute = endMinutesTotal % 60;
    const end = formatTime(endHour, endMinute);
    slots.push({ day, start, end, type });
  }
  return slots;
}

function parseStart(timeString, fallback) {
  if (!timeString) return fallback;
  const [h, m = "0"] = timeString.split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? h : fallback.hour,
    minute: Number.isFinite(m) ? m : fallback.minute,
  };
}

function lecture1h(day, start) {
  return splitConnectedBlocks(day, start.hour, start.minute, "Lecture", 1);
}

function lecture2h(day, start) {
  return splitConnectedBlocks(day, start.hour, start.minute, "Lecture", 2);
}

function tutorial1h(day, start) {
  return splitConnectedBlocks(day, start.hour, start.minute, "Tutorial", 1);
}

function threeLecturePattern(start) {
  return THREE_LECTURE_DAYS.flatMap((day) => lecture1h(day, start));
}

function generateCourseSlots(course) {
  const code = (course.course_code || "").toUpperCase();

  if (GROUP_A_COURSES.has(code) || GROUP_B_COURSES.has(code)) {
    return [];
  }

  const lectureStartParsed = parseStart(course.start, {
    hour: Number(DEFAULT_LECTURE_START.split(":")[0]),
    minute: Number(DEFAULT_LECTURE_START.split(":")[1]),
  });

  const tutorialStartParsed = {
    hour: Number(DEFAULT_TUTORIAL_START.split(":")[0]),
    minute: Number(DEFAULT_TUTORIAL_START.split(":")[1]),
  };

  if (code === "SWE477") {
    return lecture2h("Sunday", lectureStartParsed);
  }

  if (code === "SWE444") {
    return [
      ...lecture2h("Sunday", lectureStartParsed),
      ...lecture2h("Tuesday", lectureStartParsed),
    ];
  }

  return [
    ...threeLecturePattern(lectureStartParsed),
    ...tutorial1h("Monday", tutorialStartParsed),
  ];
}

function describeCourseRequirements(course) {
  const code = (course.course_code || "").toUpperCase();
  const name = course.course_name || "";
  const section = course.section_number ?? "?";

  if (GROUP_A_COURSES.has(code)) {
    return `[${code}] ${name} (Section ${section}): OUTPUT FOUR SLOTS: (1) Sunday lecture 50 minutes, (2) Tuesday lecture 50 minutes, (3) Thursday lecture 50 minutes, and (4) one tutorial 50 minutes between 08:00 and 13:00 (prefer Monday or Wednesday if free). Lectures may start at different times but must remain within working hours and keep the 10-minute gap. Do not omit any of the four required meetings; if a time conflicts, move the slot to the nearest available 50-minute block while keeping the prescribed day pattern.`;
  }

  if (GROUP_B_COURSES.has(code)) {
    return `[${code}] ${name} (Section ${section}): Provide three slots total. Option A (dispersed): two separate 50-minute lectures on one of the pairs (Sunday + Tuesday), (Sunday + Thursday), or (Tuesday + Thursday) plus one 50-minute tutorial between 08:00 and 13:00 (any free day). Option B (connected): one 2x50-minute connected lecture on Monday or Wednesday (covering two consecutive slots) plus one 50-minute tutorial between 08:00 and 13:00. Choose whichever option keeps the timetable conflict-free and include every required meeting.`;
  }

  const slots = generateCourseSlots(course);
  if (!slots.length) return null;

  const body = slots
    .map((slot) => `${slot.day} ${slot.start}-${slot.end} ${slot.type}`)
    .join("; ");

  return `[${code}] ${name} (Section ${section}): ${body}`;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Helpers ---------- */

// In your schema SchedulingCommitteeID == UserID
export async function getSchedulingCommitteeId(userId) {
  const r = await pool.query(
    `SELECT "SchedulingCommitteeID"
       FROM "SchedulingCommittee"
      WHERE "SchedulingCommitteeID"=$1`,
    [userId]
  );
  if (!r.rowCount) {
    if (SHARE_SCHEDULES_GLOBAL) {
      return null;
    }
    throw new Error("No SchedulingCommittee found for this user");
  }
  return r.rows[0].SchedulingCommitteeID;
}

// Normalize time to HH:MM:SS
function norm(t) {
  if (!t) return null;
  return t.length === 5 ? `${t}:00` : t;
}

function ensureScheduleOwnershipRow(row, res) {
  if (!row.rowCount) {
    res.status(404).json({ msg: "Slot not found" });
    return false;
  }
  if (row.rows[0].Status === "finalized") {
    res
      .status(409)
      .json({ msg: "Schedule locked", error: "Finalized schedules cannot be edited" });
    return false;
  }
  return true;
}

function validateDayTime(day, start, end) {
  if (!VALID_DAYS.has(day)) {
    return "Invalid day";
  }
  if (!start || !end) {
    return "Start and end times are required";
  }
  const [sh = "0", sm = "0"] = String(start).split(":").map(Number);
  const [eh = "0", em = "0"] = String(end).split(":").map(Number);
  if (![sh, sm, eh, em].every((v) => Number.isFinite(v))) {
    return "Invalid time format";
  }
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) {
    return "End time must be after start time";
  }
  return null;
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (!parts.length) return null;
  const [hour, minute = 0] = parts;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseDayConstraints(raw) {
  if (!raw) return null;
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return null;

  const daySet = new Set();

  for (const token of tokens) {
    const rangeParts = token.split("-").map((part) => part.trim());
    if (rangeParts.length === 1) {
      const day = normalizeDayName(rangeParts[0]);
      if (day) daySet.add(day);
      continue;
    }

    const start = normalizeDayName(rangeParts[0]);
    const end = normalizeDayName(rangeParts[1]);
    if (!start || !end) continue;

    const startIdx = DAY_INDEX.get(start.toLowerCase());
    const endIdx = DAY_INDEX.get(end.toLowerCase());
    if (startIdx === undefined || endIdx === undefined) continue;

    if (startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i += 1) {
        daySet.add(DAY_NAMES[i]);
      }
    } else {
      for (let i = startIdx; i < DAY_NAMES.length; i += 1) {
        daySet.add(DAY_NAMES[i]);
      }
      for (let i = 0; i <= endIdx; i += 1) {
        daySet.add(DAY_NAMES[i]);
      }
    }
  }

  return daySet.size ? daySet : null;
}

function parseTimeBlock(raw) {
  if (!raw) return null;
  const parts = raw.split("-").map((part) => part.trim());
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null || start >= end) return null;
  return {
    start,
    end,
    label: `${parts[0]}-${parts[1]}`,
  };
}

function parseAppliesToLevels(raw) {
  if (!raw || raw === "All") return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return [numeric];
  const candidates = raw
    .split(",")
    .map((token) => Number(token.trim()))
    .filter((value) => Number.isFinite(value));
  return candidates.length ? candidates : null;
}

function parseRuleRow(row) {
  const timeBlock = parseTimeBlock(row.timeBlock);
  const daySet = parseDayConstraints(row.dayConstraints);
  const appliesToLevels = parseAppliesToLevels(row.applies_to);
  const courseType = (row.course_type || "").toLowerCase() || null;

  return {
    description: row.description || "",
    appliesToLevels,
    courseType,
    timeBlock,
    daySet,
  };
}

function formatDaySetForPrompt(daySet) {
  if (!daySet || daySet.size === 7) return "any day";
  const ordered = DAY_NAMES.filter((day) => daySet.has(day));
  if (!ordered.length) return "any day";
  return ordered.join(", ");
}

function formatRuleForPrompt(rule) {
  const levelText = rule.appliesToLevels?.length
    ? `Level ${rule.appliesToLevels.join(", ")}`
    : "all levels";
  const courseTypeText = rule.courseType ? `${rule.courseType} courses` : "all courses";
  const dayText = formatDaySetForPrompt(rule.daySet);
  const timeText = rule.timeBlock ? rule.timeBlock.label : "any time";
  const descriptionText = rule.description ? `${rule.description}. ` : "";
  return `- ${descriptionText}Do not schedule ${courseTypeText} for ${levelText} on ${dayText} between ${timeText}.`;
}

function ruleAppliesToSection(rule, section, scheduleLevel) {
  if (rule.appliesToLevels && (scheduleLevel === null || !rule.appliesToLevels.includes(scheduleLevel))) {
    return false;
  }

  if (rule.courseType === "internal" && section?.is_external) return false;
  if (rule.courseType === "external" && section && section.is_external === false) return false;

  return true;
}

function detectRuleViolations(rules, slotContext) {
  const {
    day,
    startMinutes,
    endMinutes,
    section,
    scheduleLevel,
  } = slotContext;

  const issues = [];

  for (const rule of rules) {
    if (!ruleAppliesToSection(rule, section, scheduleLevel)) continue;

    if (rule.daySet && !rule.daySet.has(day)) continue;

    if (rule.timeBlock) {
      const overlaps = startMinutes < rule.timeBlock.end && endMinutes > rule.timeBlock.start;
      if (overlaps) {
        issues.push(rule.description || rule.timeBlock.label);
      }
    }
  }

  return issues;
}

/* ---------- 0) Init / Get Schedule ---------- */
export const initSchedule = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);
    const forceNew =
      req.query?.forceNew === "true" ||
      req.body?.forceNew === true ||
      req.body?.forceNew === "true";

    if (!forceNew) {
      const existing = await pool.query(
        `SELECT "ScheduleID"
           FROM "Schedule"
          WHERE ($1::int IS NULL OR "SchedulingCommitteeID"=$1)
            AND "Status"<>'finalized'
          ORDER BY "ScheduleID" DESC
          LIMIT 1`,
        [scFilter]
      );
      if (existing.rowCount) {
        return res.json({ scheduleId: existing.rows[0].ScheduleID });
      }
    }

    const s = await pool.query(
      `INSERT INTO "Schedule"("SchedulingCommitteeID","Status")
       VALUES($1,'draft')
       RETURNING "ScheduleID"`,
      [scId]
    );
    const newScheduleId = s.rows[0].ScheduleID;

    try {
      await recordScheduleHistory({
        scheduleId: newScheduleId,
        userId,
        summary: "Schedule initialized",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:initSchedule", historyErr);
    }

    res.json({ scheduleId: newScheduleId });
  } catch (e) {
    console.error("initSchedule:", e);
    res.status(500).json({ msg: "Failed to init schedule", error: e.message });
  }
};

/* ---------- 1) External Slot ---------- */
export const addExternalSlot = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      courseCode,
      courseName,
      sectionNumber,
      capacity,
      dayOfWeek,
      startTime,
      endTime,
    } = req.body;

    let { scheduleId } = req.body;

    const userId = resolveUserId(req);
    if (!userId) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);

    const scheduleRow = scheduleId
      ? await client.query(
          `SELECT "Level","Status"
             FROM "Schedule"
            WHERE "ScheduleID"=$1 AND ($2::int IS NULL OR "SchedulingCommitteeID"=$2)
            FOR UPDATE`,
          [scheduleId, scFilter]
        )
      : { rowCount: 0, rows: [] };

    let scheduleStatus = 'draft';
    let currentLevel = null;
    let workingScheduleId = scheduleId;

    if (!scheduleRow.rowCount) {
      const createdSchedule = await client.query(
        `INSERT INTO "Schedule"("SchedulingCommitteeID","Status")
         VALUES ($1,'draft')
         RETURNING "ScheduleID","Level","Status"`,
        [scId]
      );
      workingScheduleId = createdSchedule.rows[0].ScheduleID;
      scheduleId = workingScheduleId;
      scheduleStatus = createdSchedule.rows[0].Status;
      currentLevel = createdSchedule.rows[0].Level ?? null;
    } else {
      scheduleStatus = scheduleRow.rows[0].Status;
      currentLevel = scheduleRow.rows[0].Level ?? null;
    }

    if (!workingScheduleId) {
      workingScheduleId = scheduleId;
    }

    if (scheduleStatus === 'finalized') {
      const levelForNew = currentLevel ?? null;
      const nextGroup = levelForNew !== null ? await nextGroupNo(client, scId, levelForNew) : null;
      const newSchedule = await client.query(
        `INSERT INTO "Schedule"("SchedulingCommitteeID","Status","Level","GroupNo")
         VALUES ($1,'draft',$2,$3)
         RETURNING "ScheduleID"`,
        [scId, levelForNew, nextGroup]
      );
      workingScheduleId = newSchedule.rows[0].ScheduleID;
      scheduleId = workingScheduleId;
      scheduleStatus = 'draft';
    }

    if (currentLevel === null) {
      const inferred = await client.query(
        `SELECT DISTINCT c.level
           FROM "ScheduleSlot" s
           JOIN courses c ON c."CourseID" = s."CourseID"
          WHERE s."ScheduleID"=$1
          LIMIT 1`,
        [scheduleId]
      );
      if (inferred.rowCount) {
        currentLevel = inferred.rows[0].level ?? null;
      }
    }

    const existing = await client.query(
      `SELECT "CourseID", level FROM courses WHERE course_code=$1`,
      [courseCode]
    );

    let courseId, level;
    if (existing.rowCount) {
      courseId = existing.rows[0].CourseID;
      level = existing.rows[0].level ?? null;
    } else {
      const c = await client.query(
        `INSERT INTO courses(course_code, course_name, credit_hours, course_type, is_external, level)
         VALUES ($1,$2,3,'Mandatory',true,NULL)
         RETURNING "CourseID", level`,
        [courseCode, courseName]
      );
      courseId = c.rows[0].CourseID;
      level = c.rows[0].level ?? null;
    }

    if (level !== null) {
      if (currentLevel === null) {
        const groupNo = await nextGroupNo(client, scId, level);
        await client.query(
          `UPDATE "Schedule"
              SET "Level"=$1,
                  "GroupNo"=COALESCE("GroupNo", $3)
            WHERE "ScheduleID"=$2`,
          [level, scheduleId, groupNo]
        );
        currentLevel = level;
      } else if (currentLevel !== level) {
        const existingForLevel = await client.query(
          `SELECT "ScheduleID","GroupNo"
             FROM "Schedule"
            WHERE ($1::int IS NULL OR "SchedulingCommitteeID"=$1)
              AND "Level"=$2
              AND "Status"='draft'
            ORDER BY "ScheduleID" DESC
            LIMIT 1`,
          [scFilter, level]
        );

        if (existingForLevel.rowCount) {
          workingScheduleId = existingForLevel.rows[0].ScheduleID;
          const groupNo = existingForLevel.rows[0].GroupNo;
          if (groupNo === null) {
            const next = await nextGroupNo(client, scId, level);
            await client.query(
              `UPDATE "Schedule" SET "GroupNo"=$1 WHERE "ScheduleID"=$2`,
              [next, workingScheduleId]
            );
          }
        } else {
          const nextGroup = await nextGroupNo(client, scId, level);
          const newSchedule = await client.query(
            `INSERT INTO "Schedule"("SchedulingCommitteeID","Status","Level","GroupNo")
             VALUES ($1,'draft',$2,$3)
             RETURNING "ScheduleID"`,
            [scId, level, nextGroup]
          );
          workingScheduleId = newSchedule.rows[0].ScheduleID;
        }

        currentLevel = level;
      }
    }

    const slot = await client.query(
      `INSERT INTO "ScheduleSlot"("ScheduleID","CourseID","DayOfWeek","StartTime","EndTime")
       VALUES ($1,$2,$3,$4,$5) RETURNING "SlotID"`,
      [workingScheduleId, courseId, dayOfWeek, norm(startTime), norm(endTime)]
    );

    await client.query(
      `INSERT INTO "Sections"("ScheduleID","CourseID","SlotID","SectionNumber","Capacity","InstructorID")
       VALUES ($1,$2,$3,$4,$5,NULL)`,
      [workingScheduleId, courseId, slot.rows[0].SlotID, sectionNumber || 1, capacity || 30]
    );

    try {
      await recordScheduleHistory({
        db: client,
        scheduleId: workingScheduleId,
        userId,
        summary: "Added external slot",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:addExternalSlot", historyErr);
    }

    await client.query("COMMIT");

    res.status(201).json({
      msg: "External slot added",
      level: currentLevel,
      scheduleId: workingScheduleId,
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("addExternalSlot:", e);
    res.status(500).json({ msg: "Failed to add external slot", error: e.message });
  } finally {
    client.release();
  }
};

export const listExternalSlots = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const r = await pool.query(
      `SELECT s."SlotID",
              c.course_code, c.course_name,
              COALESCE(sec."SectionNumber",1) as section_number,
              sec."Capacity" as capacity,
              s."DayOfWeek"  as day_of_week,
              s."StartTime"  as start_time,
              s."EndTime"    as end_time
       FROM "ScheduleSlot" s
       JOIN courses c ON c."CourseID"=s."CourseID"
       LEFT JOIN "Sections" sec ON sec."SlotID"=s."SlotID"
       WHERE s."ScheduleID"=$1 AND c.is_external=true
       ORDER BY s."DayOfWeek", s."StartTime"`,
      [scheduleId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error("listExternalSlots:", e);
    res.status(500).json({ msg: "Failed to fetch external slots", error: e.message });
  }
};

/* ---------- 2) Internal Auto Populate ---------- */
export const autoListAndPrepareInternal = async (req, res) => {
  const client = await pool.connect();
  try {
    const { scheduleId } = req.params;

    const scRow = await client.query(
      `SELECT "Level" FROM "Schedule" WHERE "ScheduleID"=$1`,
      [scheduleId]
    );

    let level = scRow.rows[0]?.Level ?? null;

    if (level === null) {
      const extLevel = await client.query(
        `SELECT DISTINCT c.level
           FROM courses c
           JOIN "ScheduleSlot" s ON s."CourseID"=c."CourseID"
          WHERE s."ScheduleID"=$1 AND c.is_external=true
          LIMIT 1`,
        [scheduleId]
      );
      level = extLevel.rows[0]?.level ?? null;
    }

    if (level === null) {
      return res.json({ level: null, created: 0, items: [] });
    }

    const internalCourses = await client.query(
      `SELECT "CourseID", course_code, course_name
         FROM courses
        WHERE is_external=false AND level=$1
        ORDER BY course_code`,
      [level]
    );

    let created = 0;
    for (const c of internalCourses.rows) {
      const exists = await client.query(
        `SELECT 1 FROM "Sections"
          WHERE "ScheduleID"=$1 AND "CourseID"=$2`,
        [scheduleId, c.CourseID]
      );
      if (!exists.rowCount) {
        await client.query(
          `INSERT INTO "Sections"("ScheduleID","CourseID","InstructorID","SlotID","Capacity","SectionNumber")
           VALUES ($1,$2,NULL,NULL,30,1)`,
          [scheduleId, c.CourseID]
        );
        created++;
      }
    }

    const list = await client.query(
      `SELECT sec."SectionID" as section_id,
              c.course_code,
              c.course_name,
              COALESCE(sec."Capacity",30) as capacity,
              COALESCE(sec."SectionNumber",1) as section_number
         FROM "Sections" sec
         JOIN courses c ON c."CourseID"=sec."CourseID"
        WHERE sec."ScheduleID"=$1
          AND c.is_external=false
          AND sec."SlotID" IS NULL
        ORDER BY c.course_code`,
      [scheduleId]
    );

    res.json({ level, created, items: list.rows });
  } catch (e) {
    console.error("autoListAndPrepareInternal:", e);
    res.status(500).json({ msg: "Failed to prepare internal courses", error: e.message });
  } finally {
    client.release();
  }
};

/* ---------- 3) AI Generate Schedule (rules + fixed slot pattern) ---------- */
export const generatePreliminarySchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const scheduleIdNumeric = Number(scheduleId);
    if (!Number.isFinite(scheduleIdNumeric)) {
      return res.status(400).json({ msg: "Invalid schedule id" });
    }

    const userId = resolveUserId(req) ?? null;

    const scheduleRow = await pool.query(
      `SELECT "SchedulingCommitteeID","Level"
         FROM "Schedule"
        WHERE "ScheduleID"=$1`,
      [scheduleId]
    );

    if (!scheduleRow.rowCount) {
      return res.status(404).json({ msg: "Schedule not found" });
    }

    const committeeId = scheduleRow.rows[0].SchedulingCommitteeID;
    const rawLevel = scheduleRow.rows[0]?.Level;
    let scheduleLevel = null;
    if (rawLevel !== null && rawLevel !== undefined) {
      if (typeof rawLevel === "number") {
        scheduleLevel = Number.isFinite(rawLevel) ? rawLevel : null;
      } else {
        const numericLevel = Number(rawLevel);
        scheduleLevel = Number.isFinite(numericLevel) ? numericLevel : null;
      }
    }

    const occupied = await pool.query(
      `SELECT s."DayOfWeek" as day, s."StartTime" as start, s."EndTime" as end
         FROM "ScheduleSlot" s
        WHERE s."ScheduleID"=$1`,
      [scheduleId]
    );

    const toSchedule = await pool.query(
      `SELECT sec."SectionID" as section_id,
              c.course_code,
              c.course_name,
              COALESCE(sec."Capacity",30) as capacity,
              COALESCE(sec."SectionNumber",1) as section_number
        FROM "Sections" sec
        JOIN courses c ON c."CourseID"=sec."CourseID"
       WHERE sec."ScheduleID"=$1
         AND c.is_external=false
         AND sec."SlotID" IS NULL
       ORDER BY c.course_code`,
      [scheduleId]
    );

    const skipCodes = ["SWE479", "SWE496", "SWE497"];
    const rowsFiltered = toSchedule.rows.filter(
      (row) => !skipCodes.includes((row.course_code || "").toUpperCase())
    );

    const sectionById = new Map(
      rowsFiltered.map((row) => [Number(row.section_id), { ...row, is_external: false }])
    );

    if (rowsFiltered.length === 0) {
      return res.json({ msg: "Nothing to schedule", count: 0 });
    }

    if (rowsFiltered.length !== toSchedule.rows.length) {
      console.log(
        "Skipped courses from scheduling:",
        toSchedule.rows
          .filter((row) => skipCodes.includes((row.course_code || "").toUpperCase()))
          .map((row) => row.course_code)
      );
    }

    const requirementText = rowsFiltered
      .map(describeCourseRequirements)
      .filter(Boolean)
      .join("\n");

    // Load rules (committee-specific + global)
    const rulesDb = await pool.query(
      `SELECT description, "applies_to", "timeBlock", "dayConstraints", course_type
         FROM schedule_rules
        WHERE committee_id = $1
           OR committee_id IS NULL`,
      [committeeId ?? null]
    );

    const parsedRules = rulesDb.rows.map(parseRuleRow);
    const enforcingRules = parsedRules.filter((rule) => Boolean(rule.timeBlock));
    const allRulesText = parsedRules.length
      ? parsedRules.map((rule) => formatRuleForPrompt(rule)).join("\n")
      : "None";

    const fixedPattern = `
Time/slot rules:
- 1 hour = 50 minutes (always include the 10 minute gap afterwards).
- 2 hours connected = two back-to-back 50 minute slots (e.g., 08:00-08:50 AND 09:00-09:50). Treat this as one meeting that spans two slots.
- Keep the global lunch break 12:00-13:00 empty.

Lecture spacing rules:
- Do not place two 1-hour lectures for the same course on the same day unless the connected option is explicitly specified.
- Default 3-lecture patterns use Sunday, Tuesday, Thursday (one lecture per day).

Course-specific patterns (24h clock):
- SWE477: one 2h connected lecture each week.
- SWE444: two 2h connected lectures on different days in the same week.
- Group A (SWE211, SWE314, SWE312, SWE321, SWE381, SWE482, SWE434, SWE466): exactly three 50-minute lectures on Sunday, Tuesday, and Thursday. The three lectures can start at different times as long as they maintain the 10-minute gap afterwards. Add one 50-minute tutorial between 08:00 and 13:00 on any available day.
- Group A courses must output four slots total (three lectures + one tutorial). If a preferred day/time is taken, move the session but keep the overall pattern.
- Group B (SWE455, SWE333): choose either two dispersed 50-minute lectures on (Sunday + Tuesday), (Sunday + Thursday), or (Tuesday + Thursday), OR use one connected 2x50-minute block on Monday or Wednesday. Add one 50-minute tutorial between 08:00 and 13:00 on any available day.
- Group B courses must output three slots total (two lecture hours + one tutorial hour). Maintain the chosen option's structure even if you need to shift the exact start time.
- All other internal courses: three separate 50-minute lectures on Sunday, Tuesday, Thursday plus one 50-minute tutorial (default to morning slots).
`;

    const prompt = `
You are a university scheduling assistant.
Working days: Sunday-Thursday.
Follow these time rules strictly:
${fixedPattern}

Scheduling Rules from database (hard constraints - never place a slot that overlaps these windows):
${allRulesText}

Occupied slots: ${JSON.stringify(occupied.rows)}
Internal courses needing schedule: ${JSON.stringify(rowsFiltered)}

Course requirements summary:
${requirementText || "None"}

Return ONLY JSON array:
[{"section_id":number,"day":"Sunday|Monday|...","start":"HH:MM","end":"HH:MM"}]
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You schedule courses into free timetable slots with no overlaps and respect rules." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    });

    let resultsRaw = response.choices?.[0]?.message?.content || "[]";
    const jsonMatch = resultsRaw.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch ? jsonMatch[0] : resultsRaw);

    const conflicts = [];
    let placedCount = 0;

    for (const a of results) {
      const sectionId = Number(a.section_id);
      if (!Number.isFinite(sectionId)) {
        conflicts.push({
          section_id: a.section_id,
          day: a.day,
          start: a.start,
          end: a.end,
          reason: "invalid section id",
        });
        continue;
      }

      const normalizedDay = normalizeDayName(a.day);
      if (!normalizedDay) {
        conflicts.push({
          section_id: sectionId,
          day: a.day,
          start: a.start,
          end: a.end,
          reason: "invalid day",
        });
        continue;
      }

      const startMinutes = parseTimeToMinutes(a.start);
      const endMinutes = parseTimeToMinutes(a.end);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        conflicts.push({
          section_id: sectionId,
          day: normalizedDay,
          start: a.start,
          end: a.end,
          reason: "invalid time range",
        });
        continue;
      }

      const sectionInfo = sectionById.get(sectionId);
      if (!sectionInfo) {
        conflicts.push({
          section_id: sectionId,
          day: normalizedDay,
          start: a.start,
          end: a.end,
          reason: "unknown section",
        });
        continue;
      }

      const ruleIssues = enforcingRules.length
        ? detectRuleViolations(enforcingRules, {
            day: normalizedDay,
            startMinutes,
            endMinutes,
            section: sectionInfo,
            scheduleLevel,
          })
        : [];

      if (ruleIssues.length) {
        conflicts.push({
          section_id: sectionId,
          day: normalizedDay,
          start: a.start,
          end: a.end,
          reason: `violates rule(s): ${ruleIssues.join('; ')}`,
        });
        continue;
      }

      const start = norm(a.start);
      const end = norm(a.end);

      const overlap = await pool.query(
        `SELECT 1
           FROM "ScheduleSlot"
          WHERE "ScheduleID"=$1
            AND "DayOfWeek"=$2
            AND NOT ($4 <= "StartTime" OR $3 >= "EndTime")
          LIMIT 1`,
        [scheduleId, normalizedDay, start, end]
      );

      if (overlap.rowCount) {
        conflicts.push({
          section_id: sectionId,
          day: normalizedDay,
          start: a.start,
          end: a.end,
          reason: "conflicts with existing slot",
        });
        continue;
      }

      const slot = await pool.query(
        `INSERT INTO "ScheduleSlot"("ScheduleID","CourseID","DayOfWeek","StartTime","EndTime")
         SELECT $1,"CourseID",$2,$3,$4 FROM "Sections" WHERE "SectionID"=$5
         RETURNING "SlotID"`,
        [scheduleId, normalizedDay, start, end, sectionId]
      );

      await pool.query(
        `UPDATE "Sections" SET "SlotID"=$1 WHERE "SectionID"=$2`,
        [slot.rows[0].SlotID, sectionId]
      );

      placedCount += 1;
    }

    if (placedCount > 0) {
      await pool.query(
        `UPDATE "Schedule" SET "Status"='generated' WHERE "ScheduleID"=$1`,
        [scheduleIdNumeric]
      );
    }

    try {
      await recordScheduleHistory({
        scheduleId: scheduleIdNumeric,
        userId,
        summary: placedCount
          ? `Generated preliminary schedule (+${placedCount} slots)`
          : "Ran preliminary generation",
        changeNote: conflicts.length ? JSON.stringify({ conflicts }) : null,
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:generatePreliminarySchedule", historyErr);
    }

    res.json({
      msg: placedCount ? "Preliminary schedule generated" : "No slots generated",
      placed: placedCount,
      skipped: conflicts,
    });
  } catch (e) {
    console.error("generatePreliminarySchedule:", e);
    res.status(500).json({ msg: "Failed to generate schedule", error: e.message });
  }
};

/* ---------- 4) Grid & Share ---------- */
export const listAllSlotsForGrid = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const r = await pool.query(
      `SELECT s."SlotID"       AS slot_id,
              sec."SectionID"  AS section_id,
              c.is_external,
              c.course_code,
              c.course_name,
              COALESCE(sec."SectionNumber",1) AS section_number,
              COALESCE(sec."Capacity",30)     AS capacity,
              s."DayOfWeek"   AS day,
              s."StartTime"   AS start,
              s."EndTime"     AS end
       FROM "ScheduleSlot" s
       JOIN courses c ON c."CourseID"=s."CourseID"
       LEFT JOIN "Sections" sec ON sec."SlotID"=s."SlotID"
       WHERE s."ScheduleID"=$1
       ORDER BY s."DayOfWeek", s."StartTime"`,
      [scheduleId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error("listAllSlotsForGrid:", e);
    res.status(500).json({ msg: "Failed to fetch grid slots", error: e.message });
  }
};

export const shareSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = resolveUserId(req) ?? null;
    const numeric = Number(scheduleId);
    const scheduleIdForHistory = Number.isFinite(numeric) ? numeric : scheduleId;
    await pool.query(
      `UPDATE "Schedule" SET "Status"='shared' WHERE "ScheduleID"=$1`,
      [scheduleId]
    );

    try {
      await recordScheduleHistory({
        scheduleId: scheduleIdForHistory,
        userId,
        summary: "Shared schedule",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:shareSchedule", historyErr);
    }
    res.json({ msg: "Schedule shared with TLC" });
  } catch (e) {
    console.error("shareSchedule:", e);
    res.status(500).json({ msg: "Failed to share schedule", error: e.message });
  }
};

export const approveSchedule = async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({ msg: "Invalid schedule id" });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);

    const current = await pool.query(
      `SELECT "Status","Level","GroupNo"
         FROM "Schedule"
        WHERE "ScheduleID"=$1 AND ($2::int IS NULL OR "SchedulingCommitteeID"=$2)`,
      [scheduleId, scFilter]
    );

    if (!current.rowCount) {
      return res.status(404).json({ msg: "Schedule not found" });
    }

    const status = current.rows[0].Status;
    if (status === "finalized") {
      return res.status(200).json({ msg: "Schedule already finalized" });
    }
    if (status !== "approved") {
      return res
        .status(409)
        .json({ msg: "Schedule must be approved before finalization", status });
    }

    await pool.query(
      `UPDATE "Schedule" SET "Status"='finalized' WHERE "ScheduleID"=$1`,
      [scheduleId]
    );

    try {
      await recordScheduleHistory({
        scheduleId,
        userId,
        summary: "Finalized schedule",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:approveSchedule", historyErr);
    }

    const scheduleLevel = current.rows[0]?.Level ?? null;
    const scheduleGroup = current.rows[0]?.GroupNo ?? null;
    const createdByVal = Number.isFinite(Number(userId)) ? Number(userId) : null;
    const message = "Schedule finalized, you can view it now";
    const dataPayload = JSON.stringify({
      action: "schedule_finalized",
      scheduleId,
      level: scheduleLevel,
      groupNo: scheduleGroup,
    });

    try {
      await pool.query(
        `INSERT INTO "Notifications"
          ("ReceiverID","CreatedBy","Message","Type","Entity","EntityId","Data")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          null,
          createdByVal,
          message,
          "schedule",
          "Schedule",
          scheduleId,
          dataPayload,
        ]
      );
    } catch (notifyErr) {
      console.warn("approveSchedule: notification insert skipped", notifyErr?.message || notifyErr);
    }

    res.json({ msg: "Schedule finalized" });
  } catch (e) {
    console.error("approveSchedule:", e);
    res.status(500).json({ msg: "Failed to finalize schedule", error: e.message });
  }
};

export const createManualSlot = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      scheduleId,
      courseCode,
      courseName,
      sectionNumber,
      capacity,
      day,
      start,
      end,
      isExternal = true,
      level = null,
    } = req.body ?? {};

    const normalizedIsExternal = isExternal === true;
    const courseType = normalizedIsExternal ? "Mandatory" : "Elective";

    const scheduleIdNumeric = Number(scheduleId);
    if (!Number.isFinite(scheduleIdNumeric)) {
      return res.status(400).json({ msg: "Invalid schedule id" });
    }

    if (!courseCode || !courseName) {
      return res.status(400).json({ msg: "Course code and name are required" });
    }

    const validationError = validateDayTime(day, start, end);
    if (validationError) {
      return res.status(400).json({ msg: validationError });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);

    await client.query("BEGIN");

    const scheduleRow = await client.query(
      `SELECT "ScheduleID","Status","Level"
         FROM "Schedule"
        WHERE "ScheduleID"=$1 AND ($2::int IS NULL OR "SchedulingCommitteeID"=$2)
        FOR UPDATE`,
      [scheduleIdNumeric, scFilter]
    );

    if (!ensureScheduleOwnershipRow(scheduleRow, res)) {
      await client.query("ROLLBACK");
      return;
    }

    const normalizedCode = courseCode.trim().toUpperCase();
    const trimmedName = courseName.trim();

    const courseRow = await client.query(
      `SELECT "CourseID", course_name, level, is_external, course_type
          FROM courses
         WHERE UPPER(course_code)=$1`,
      [normalizedCode]
    );

    let courseId;
    let courseLevel = courseRow.rows[0]?.level ?? null;
    const courseTypeDb = courseRow.rows[0]?.course_type ?? null;
    const courseExternalDb = courseRow.rows[0]?.is_external ?? null;

    if (courseRow.rowCount) {
      courseId = courseRow.rows[0].CourseID;
      const existingName = courseRow.rows[0].course_name ?? "";
      if (trimmedName && trimmedName !== existingName) {
        await client.query(
          `UPDATE courses SET course_name=$1 WHERE "CourseID"=$2`,
          [trimmedName, courseId]
        );
      }
      if (level !== null && level !== undefined && courseLevel === null) {
        await client.query(
          `UPDATE courses SET level=$1 WHERE "CourseID"=$2`,
          [level, courseId]
        );
        courseLevel = level;
      }
      const normalizedCourseTypeDb = courseTypeDb ? String(courseTypeDb).trim().toLowerCase() : null;
      if (!normalizedCourseTypeDb || normalizedCourseTypeDb !== courseType.toLowerCase()) {
        await client.query(
          `UPDATE courses SET course_type=$1 WHERE "CourseID"=$2`,
          [courseType, courseId]
        );
      }
      if (courseExternalDb !== normalizedIsExternal) {
        await client.query(
          `UPDATE courses SET is_external=$1 WHERE "CourseID"=$2`,
          [normalizedIsExternal, courseId]
        );
      }
    } else {
      const insertedCourse = await client.query(
        `INSERT INTO courses(course_code, course_name, credit_hours, course_type, is_external, level)
         VALUES ($1,$2,3,$3,$4,$5)
         RETURNING "CourseID", level`,
        [normalizedCode, trimmedName, courseType, normalizedIsExternal, level ?? null]
      );
      courseId = insertedCourse.rows[0].CourseID;
      courseLevel = insertedCourse.rows[0].level ?? null;
    }

    const currentLevel = scheduleRow.rows[0].Level ?? null;
    const requestedLevel = level ?? courseLevel;

    if (currentLevel !== null && requestedLevel !== null && currentLevel !== requestedLevel) {
      await client.query("ROLLBACK");
      return res.status(400).json({ msg: "Course level does not match schedule level" });
    }

    if (courseLevel === null && level !== null && level !== undefined) {
      courseLevel = level;
    }

    if (currentLevel === null && courseLevel !== null) {
      const nextGroup = await nextGroupNo(client, scId, courseLevel);
      await client.query(
        `UPDATE "Schedule"
            SET "Level"=$1,
                "GroupNo"=COALESCE("GroupNo", $3)
          WHERE "ScheduleID"=$2`,
        [courseLevel, scheduleIdNumeric, nextGroup]
      );
    }

    const slot = await client.query(
      `INSERT INTO "ScheduleSlot"("ScheduleID","CourseID","DayOfWeek","StartTime","EndTime")
       VALUES ($1,$2,$3,$4,$5)
       RETURNING "SlotID"`,
      [scheduleIdNumeric, courseId, day, norm(start), norm(end)]
    );

    const sectionNum = Number(sectionNumber ?? 1);
    const capacityNum = Number(capacity ?? 30);

    await client.query(
      `INSERT INTO "Sections"("ScheduleID","CourseID","SlotID","SectionNumber","Capacity","InstructorID")
       VALUES ($1,$2,$3,$4,$5,NULL)`,
      [
        scheduleIdNumeric,
        courseId,
        slot.rows[0].SlotID,
        Number.isFinite(sectionNum) && sectionNum > 0 ? sectionNum : 1,
        Number.isFinite(capacityNum) && capacityNum > 0 ? capacityNum : 30,
      ]
    );

    try {
      await recordScheduleHistory({
        db: client,
        scheduleId: scheduleIdNumeric,
        userId,
        summary: "Added slot manually",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:createManualSlot", historyErr);
    }

    await client.query("COMMIT");

    res
      .status(201)
      .json({ msg: "Slot created", scheduleId: scheduleIdNumeric, slotId: slot.rows[0].SlotID });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("createManualSlot:", e);
    res.status(500).json({ msg: "Failed to add slot", error: e.message });
  } finally {
    client.release();
  }
};

export const updateScheduleSlot = async (req, res) => {
  const client = await pool.connect();
  try {
    const slotId = Number(req.params.slotId);
    if (!Number.isFinite(slotId)) {
      return res.status(400).json({ msg: "Invalid slot id" });
    }

    const { day, start, end } = req.body ?? {};
    const validationError = validateDayTime(day, start, end);
    if (validationError) {
      return res.status(400).json({ msg: validationError });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);

    await client.query("BEGIN");

    const slotRow = await client.query(
      `SELECT s."ScheduleID", sch."Status"
         FROM "ScheduleSlot" s
         JOIN "Schedule" sch ON sch."ScheduleID"=s."ScheduleID"
        WHERE s."SlotID"=$1 AND ($2::int IS NULL OR sch."SchedulingCommitteeID"=$2)
        FOR UPDATE`,
      [slotId, scFilter]
    );

    if (!ensureScheduleOwnershipRow(slotRow, res)) {
      await client.query("ROLLBACK");
      return;
    }

    await client.query(
      `UPDATE "ScheduleSlot"
          SET "DayOfWeek"=$1,
              "StartTime"=$2,
              "EndTime"=$3
        WHERE "SlotID"=$4`,
      [day, norm(start), norm(end), slotId]
    );

    try {
      await recordScheduleHistory({
        db: client,
        scheduleId: slotRow.rows[0].ScheduleID,
        userId,
        summary: "Updated slot",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:updateScheduleSlot", historyErr);
    }

    await client.query("COMMIT");

    res.json({ msg: "Slot updated", scheduleId: slotRow.rows[0].ScheduleID });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("updateScheduleSlot:", e);
    res.status(500).json({ msg: "Failed to update slot", error: e.message });
  } finally {
    client.release();
  }
};

export const removeScheduleSlot = async (req, res) => {
  const client = await pool.connect();
  try {
    const slotId = Number(req.params.slotId);
    if (!Number.isFinite(slotId)) {
      return res.status(400).json({ msg: "Invalid slot id" });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);

    await client.query("BEGIN");

    const slotRow = await client.query(
      `SELECT s."ScheduleID", sch."Status"
         FROM "ScheduleSlot" s
         JOIN "Schedule" sch ON sch."ScheduleID"=s."ScheduleID"
        WHERE s."SlotID"=$1 AND ($2::int IS NULL OR sch."SchedulingCommitteeID"=$2)
        FOR UPDATE`,
      [slotId, scFilter]
    );

    if (!ensureScheduleOwnershipRow(slotRow, res)) {
      await client.query("ROLLBACK");
      return;
    }

    await client.query(
      `UPDATE "Sections" SET "SlotID"=NULL WHERE "SlotID"=$1`,
      [slotId]
    );

    await client.query(
      `DELETE FROM "ScheduleSlot" WHERE "SlotID"=$1`,
      [slotId]
    );

    try {
      await recordScheduleHistory({
        db: client,
        scheduleId: slotRow.rows[0].ScheduleID,
        userId,
        summary: "Removed slot",
      });
    } catch (historyErr) {
      console.error("recordScheduleHistory:removeScheduleSlot", historyErr);
    }

    await client.query("COMMIT");

    res.json({ msg: "Slot removed", scheduleId: slotRow.rows[0].ScheduleID });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("removeScheduleSlot:", e);
    res.status(500).json({ msg: "Failed to remove slot", error: e.message });
  } finally {
    client.release();
  }
};
// server/controllers/scheduleController.js
export const listSchedules = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);
    const scFilter = scopeCommitteeFilter(scId);
    const r = await pool.query(
      `SELECT "ScheduleID","Level","Status","GroupNo"
         FROM "Schedule"
        WHERE ($1::int IS NULL OR "SchedulingCommitteeID"=$1)
          AND "Status"<>'archived'
        ORDER BY COALESCE("Level", 0), COALESCE("GroupNo", 0), "ScheduleID"`,
      [scFilter]
    );
    const annotated = r.rows.map((row) => {
      const levelNumber = Number(row.Level);
      const isIrregular = Number.isFinite(levelNumber) && IRREGULAR_LEVELS.has(levelNumber);
      return {
        ...row,
        IsIrregular: isIrregular,
        IrregularNote: isIrregular
          ? "Irregular level schedule (reserved for irregular students)."
          : null,
      };
    });
    res.json(annotated);
  } catch (e) {
    console.error("listSchedules:", e);
    res.status(500).json({ msg: "Failed to list schedules", error: e.message });
  }
};
