import pool from "../../DataBase_config/DB_config.js";
import { resolveUserId, getSchedulingCommitteeId } from "./scheduleController.js";

function toInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapHistoryRow(row) {
  return {
    historyId: row.history_id,
    scheduleId: row.schedule_id,
    versionNo: row.version_no,
    summary: row.summary,
    status: row.status,
    level: row.level,
    groupNo: row.group_no,
    slotCount: row.slot_count,
    changedBy: row.changed_by,
    changeNote: row.change_note,
    createdAt: row.created_at,
  };
}

function mapHistoryDetail(row) {
  return {
    ...mapHistoryRow(row),
    snapshot: row.snapshot,
  };
}

export const listHistory = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);

    const levelFilter = toInteger(req.query.level);
    const groupFilter = toInteger(req.query.groupNo ?? req.query.group);
    const scheduleFilter = toInteger(req.query.scheduleId ?? req.query.schedule);
    const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;

    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
    const offset = (page - 1) * limit;

    const params = [scId];
    const where = [`sch."SchedulingCommitteeID" = $${params.length}`];

    if (scheduleFilter !== null) {
      params.push(scheduleFilter);
      where.push(`h.schedule_id = $${params.length}`);
    }

    if (levelFilter !== null) {
      params.push(levelFilter);
      where.push(`h.level = $${params.length}`);
    }

    if (groupFilter !== null) {
      params.push(groupFilter);
      where.push(`h.group_no = $${params.length}`);
    }

    if (statusFilter) {
      params.push(statusFilter);
      where.push(`LOWER(h.status) = $${params.length}`);
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const sql = `
      SELECT h.history_id,
             h.schedule_id,
             h.version_no,
             h.summary,
             h.status,
             h.level,
             h.group_no,
             h.slot_count,
             h.changed_by,
             h.change_note,
             h.created_at
        FROM schedule_history h
        JOIN "Schedule" sch ON sch."ScheduleID" = h.schedule_id
       WHERE ${where.join(" AND ")}
       ORDER BY h.created_at DESC, h.history_id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const { rows } = await pool.query(sql, params);

    res.json({
      items: rows.map(mapHistoryRow),
      meta: {
        page,
        limit,
        returned: rows.length,
        hasMore: rows.length === limit,
      },
    });
  } catch (e) {
    console.error("listHistory:", e);
    res.status(500).json({ msg: "Failed to load history", error: e.message });
  }
};

export const getHistoryEntry = async (req, res) => {
  try {
    const historyId = Number(req.params.historyId);
    if (!Number.isFinite(historyId)) {
      return res.status(400).json({ msg: "Invalid history id" });
    }

    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized", error: "Missing user context" });
    }

    const scId = await getSchedulingCommitteeId(userId);

    const historyRes = await pool.query(
      `SELECT h.history_id,
              h.schedule_id,
              h.version_no,
              h.summary,
              h.status,
              h.level,
              h.group_no,
              h.slot_count,
              h.snapshot,
              h.changed_by,
              h.change_note,
              h.created_at,
              sch."SchedulingCommitteeID" AS "ownerId"
         FROM schedule_history h
         JOIN "Schedule" sch ON sch."ScheduleID" = h.schedule_id
        WHERE h.history_id = $1
        LIMIT 1`,
      [historyId]
    );

    if (!historyRes.rowCount) {
      return res.status(404).json({ msg: "History entry not found" });
    }

    const historyRow = historyRes.rows[0];
    if (historyRow.ownerId !== scId) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    res.json({
      history: mapHistoryDetail(historyRow),
    });
  } catch (e) {
    console.error("getHistoryEntry:", e);
    res.status(500).json({ msg: "Failed to load history entry", error: e.message });
  }
};
