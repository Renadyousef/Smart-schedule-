// controllers/students.js
import pool from "../../DataBase_config/DB_config.js";

/**
 * GET /students/:id
 * يرجّع StudentID, program, level, preferences, reasons, notes
 */
export const getStudent = async (req, res) => {
  try {
    const { id } = req.params; // StudentID
    const sql = `
      select "StudentID","program","level","preferences","reasons","notes"
      from "Students"
      where "StudentID" = $1
      limit 1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Student not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error("getStudent error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /students/:id/preferences/history
 * يرجّع أحدث السجلات أولاً
 */
export const getPreferencesHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT "id","preferences","reasons","notes","created_at"
      FROM "StudentPreferenceHistory"
      WHERE "StudentID" = $1
      ORDER BY "created_at" DESC, "id" DESC
      LIMIT 100
    `;
    const { rows } = await pool.query(sql, [id]);
    return res.json(rows);
  } catch (err) {
    console.error("getPreferencesHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * PUT /students/:id/preferences
 * body: {
 *   preferences: [...],         // jsonb
 *   reasons?: string[] = [],    // interest|gpa|easy|schedule
 *   notes?: string | null
 * }
 * - يحدث Students
 * - يسجّل نسخة في StudentPreferenceHistory (ضمن معاملة)
 */
export const updatePreferences = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params; // StudentID
    const { preferences, reasons = [], notes = null } = req.body;

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: "preferences must be an array" });
    }
    if (!Array.isArray(reasons)) {
      return res.status(400).json({ error: "reasons must be an array" });
    }

    await client.query("BEGIN");

    // update Students
    const upSql = `
      UPDATE "Students"
      SET "preferences" = $1::jsonb,
          "reasons"     = $2::jsonb,
          "notes"       = $3
      WHERE "StudentID" = $4
      RETURNING "StudentID","preferences","reasons","notes"
    `;
    const upParams = [JSON.stringify(preferences), JSON.stringify(reasons), notes, id];
    const upRes = await client.query(upSql, upParams);
    if (upRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found" });
    }

    // insert history
    const histSql = `
      INSERT INTO "StudentPreferenceHistory"
        ("StudentID","preferences","reasons","notes")
      VALUES ($1,$2::jsonb,$3::jsonb,$4)
      RETURNING "id","created_at"
    `;
    const histParams = [id, JSON.stringify(preferences), JSON.stringify(reasons), notes];
    const histRes = await client.query(histSql, histParams);

    await client.query("COMMIT");

    // Try to create a broadcast notification for registrars (non-blocking)
    try {
      const message = `Student ${id} updated elective preferences (${preferences.length} courses)`;
      const dataPayload = {
        action: "student_preferences_updated",
        studentId: Number(id),
        preferencesCount: Array.isArray(preferences) ? preferences.length : 0,
        reasons,
        notes,
        preview: (Array.isArray(preferences) ? preferences : []).slice(0, 5).map(p => ({
          order: p?.order,
          code: p?.code,
          name: p?.name,
        })),
      };
      await pool.query(
        `insert into "Notifications"
           ("Message","CreatedAt","CreatedBy","UserID","ReceiverID","Type","Entity","EntityId","Data","IsRead")
         values ($1, now(), $2, $3, $4, $5, $6, $7, $8::jsonb, false)`,
        [
          message,
          Number(id) || null, // CreatedBy
          Number(id) || null, // UserID (safe if NOT NULL)
          null,               // ReceiverID broadcast to registrars
          "StudentPreferencesUpdated",
          "StudentPreferences",
          histRes.rows[0]?.id ?? null,
          JSON.stringify(dataPayload),
        ]
      );
    } catch (notifyErr) {
      console.warn("[students.updatePreferences] notification insert failed:", notifyErr?.message);
    }

    return res.json({
      ...upRes.rows[0],
      history_id: histRes.rows[0].id,
      history_created_at: histRes.rows[0].created_at,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updatePreferences error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};
