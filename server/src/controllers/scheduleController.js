// server/controllers/scheduleController.js
import pool from "../../DataBase_config/DB_config.js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Helpers ---------- */

// In your schema SchedulingCommitteeID == UserID
async function getSchedulingCommitteeId(userId) {
  const r = await pool.query(
    `SELECT "SchedulingCommitteeID"
       FROM "SchedulingCommittee"
      WHERE "SchedulingCommitteeID"=$1`,
    [userId]
  );
  if (!r.rowCount) throw new Error("No SchedulingCommittee found for this user");
  return r.rows[0].SchedulingCommitteeID;
}

// Normalize time to HH:MM:SS
function norm(t) {
  if (!t) return null;
  return t.length === 5 ? `${t}:00` : t;
}

/* ---------- 0) Init / Get Schedule ---------- */
export const initSchedule = async (req, res) => {
  try {
    const scId = await getSchedulingCommitteeId(req.user.id);

    const existing = await pool.query(
      `SELECT "ScheduleID"
         FROM "Schedule"
        WHERE "SchedulingCommitteeID"=$1
          AND "Status"<>'shared'
        LIMIT 1`,
      [scId]
    );
    if (existing.rowCount) {
      return res.json({ scheduleId: existing.rows[0].ScheduleID });
    }

    const s = await pool.query(
      `INSERT INTO "Schedule"("SchedulingCommitteeID","Status")
       VALUES($1,'draft')
       RETURNING "ScheduleID"`,
      [scId]
    );
    res.json({ scheduleId: s.rows[0].ScheduleID });
  } catch (e) {
    console.error("initSchedule:", e);
    res.status(500).json({ msg: "Failed to init schedule", error: e.message });
  }
};

/* ---------- 1) External Slot ---------- */
export const addExternalSlot = async (req, res) => {
  try {
    const {
      scheduleId,
      courseCode,
      courseName,
      sectionNumber,
      capacity,
      dayOfWeek,
      startTime,
      endTime,
    } = req.body;

    const scId = await getSchedulingCommitteeId(req.user.id);

    const sCheck = await pool.query(
      `SELECT "ScheduleID" FROM "Schedule"
       WHERE "ScheduleID"=$1 AND "SchedulingCommitteeID"=$2`,
      [scheduleId, scId]
    );
    if (!sCheck.rowCount)
      return res.status(403).json({ msg: "Schedule not owned by this committee" });

    const existing = await pool.query(
      `SELECT "CourseID", level FROM courses WHERE course_code=$1`,
      [courseCode]
    );

    let courseId, level;
    if (existing.rowCount) {
      courseId = existing.rows[0].CourseID;
      level = existing.rows[0].level ?? null;
    } else {
      const c = await pool.query(
        `INSERT INTO courses(course_code, course_name, credit_hours, course_type, is_external, level)
         VALUES ($1,$2,3,'Mandatory',true,NULL)
         RETURNING "CourseID", level`,
        [courseCode, courseName]
      );
      courseId = c.rows[0].CourseID;
      level = c.rows[0].level ?? null;
    }

    if (level !== null) {
      await pool.query(
        `UPDATE "Schedule"
            SET "Level"=$1
          WHERE "ScheduleID"=$2 AND "Level" IS NULL`,
        [level, scheduleId]
      );
    }

    const s = await pool.query(
      `INSERT INTO "ScheduleSlot"("ScheduleID","CourseID","DayOfWeek","StartTime","EndTime")
       VALUES ($1,$2,$3,$4,$5) RETURNING "SlotID"`,
      [scheduleId, courseId, dayOfWeek, norm(startTime), norm(endTime)]
    );

    await pool.query(
      `INSERT INTO "Sections"("ScheduleID","CourseID","SlotID","SectionNumber","Capacity","InstructorID")
       VALUES ($1,$2,$3,$4,$5,NULL)`,
      [scheduleId, courseId, s.rows[0].SlotID, sectionNumber || 1, capacity || 30]
    );

    res.status(201).json({ msg: "External slot added", level });
  } catch (e) {
    console.error("addExternalSlot:", e);
    res.status(500).json({ msg: "Failed to add external slot", error: e.message });
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

    const extLevel = await client.query(
      `SELECT DISTINCT c.level
         FROM courses c
         JOIN "ScheduleSlot" s ON s."CourseID"=c."CourseID"
        WHERE s."ScheduleID"=$1 AND c.is_external=true
        LIMIT 1`,
      [scheduleId]
    );

    let level = extLevel.rows[0]?.level ?? null;

    if (level === null) {
      const sc = await client.query(
        `SELECT "Level" FROM "Schedule" WHERE "ScheduleID"=$1`,
        [scheduleId]
      );
      level = sc.rows[0]?.Level ?? null;
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

    if (toSchedule.rowCount === 0) {
      return res.json({ msg: "Nothing to schedule", count: 0 });
    }

    // Load rules (committee-specific + global)
    const rulesDb = await pool.query(
      `SELECT description, "applies_to", "timeBlock", "dayConstraints", course_type
         FROM schedule_rules
        WHERE committee_id = (SELECT "SchedulingCommitteeID"
                                FROM "Schedule"
                               WHERE "ScheduleID"=$1)
           OR committee_id IS NULL`,
      [scheduleId]
    );

    const allRules = rulesDb.rows.map(r =>
      `- ${r.description || ""} (applies_to:${r.applies_to || "all"} timeBlock:${r.timeBlock || "any"} days:${r.dayConstraints || "any"} course_type:${r.course_type || "any"})`
    ).join("\n");

    const fixedPattern = `
Time Slots:
- Each lecture slot is 50min followed by a 10min break (e.g., 08:00-08:50, 09:00-09:50, ...).
- Two-hour classes/labs use continuous 120min (e.g., 09:00-10:50).
- Global lunch break 12:00–13:00 must stay empty.

Course-Specific Patterns (24h time):
- CSC111 or CSC113: 3×1h lectures (on different days), 1×1h tutorial, 1×2h lab.
- SWE477 or any IC course: 1×2h lecture.
- SWE444: 2×2h lectures (on two different days).
- MATH* or PHYS*: 3×1h lectures (on different days) + 1×2h tutorial.
- OPER122: 1×2h lecture + 1×2h tutorial.
- SWE455: 2×1h lectures (on different days) + 1×1h tutorial.
- Other courses: default = 3×1h lectures (on different days) + 1×1h tutorial.

Extra constraints:
- Do NOT schedule two 1h lectures of the same course on the same day.
`;

    const prompt = `
You are a university scheduling assistant.
Working days: Sunday–Thursday.
Follow these time rules strictly:
${fixedPattern}

Scheduling Rules from database:
${allRules || "None"}

Occupied slots: ${JSON.stringify(occupied.rows)}
Internal courses needing schedule: ${JSON.stringify(toSchedule.rows)}

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

    for (const a of results) {
      const start = norm(a.start);
      const end = norm(a.end);

      const slot = await pool.query(
        `INSERT INTO "ScheduleSlot"("ScheduleID","CourseID","DayOfWeek","StartTime","EndTime")
         SELECT $1,"CourseID",$2,$3,$4 FROM "Sections" WHERE "SectionID"=$5
         RETURNING "SlotID"`,
        [scheduleId, a.day, start, end, a.section_id]
      );

      await pool.query(
        `UPDATE "Sections" SET "SlotID"=$1 WHERE "SectionID"=$2`,
        [slot.rows[0].SlotID, a.section_id]
      );
    }

    res.json({ msg: "Preliminary schedule generated", count: results.length });
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
      `SELECT c.is_external,
              c.course_code, c.course_name,
              COALESCE(sec."SectionNumber",1) as section_number,
              COALESCE(sec."Capacity",30) as capacity,
              s."DayOfWeek"  as day,
              s."StartTime"  as start,
              s."EndTime"    as end
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
    await pool.query(
      `UPDATE "Schedule" SET "Status"='shared' WHERE "ScheduleID"=$1`,
      [scheduleId]
    );
    res.json({ msg: "Schedule shared with TLC" });
  } catch (e) {
    console.error("shareSchedule:", e);
    res.status(500).json({ msg: "Failed to share schedule", error: e.message });
  }
};
// server/controllers/scheduleController.js
export const listSchedules = async (req, res) => {
  try {
    const scId = await getSchedulingCommitteeId(req.user.id);
    const r = await pool.query(
      `SELECT "ScheduleID","Level","Status","CreatedAt"
         FROM "Schedule"
        WHERE "SchedulingCommitteeID"=$1
        ORDER BY "CreatedAt" DESC`,
      [scId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error("listSchedules:", e);
    res.status(500).json({ msg: "Failed to list schedules", error: e.message });
  }
};