// server/routes/profile.js
import express from "express";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/**
 * GET /api/profile/:id
 * يرجّع بيانات المستخدم من users + level من students(student_id = id)
 */
router.get("/profile/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    // users
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role, department_id")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // students.level (student_id = userId)
    let level = null;
    if ((user.role || "").toLowerCase() === "student") {
      const { data: student, error: studErr } = await supabase
        .from("students")
        .select("level")
        .eq("student_id", userId)
        .single();

      // لو مافيه صف، studErr ممكن يكون PGRST116 (no rows)
      if (!studErr && student) level = student.level ?? null;
    }

    return res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      department: user.department_id, // لو تبغين اسم القسم، سويه join أو رجّعيه من فيو
      level,
    });
  } catch (e) {
    console.error("GET /api/profile error:", e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * PUT /api/profile/:id
 * يحدث users + يعمل upsert على students(level) بنفس student_id = id
 * يستقبل body: { firstName, lastName, email, level }
 */
router.put("/profile/:id", async (req, res) => {
  const userId = req.params.id;
  const { firstName, lastName, email, level } = req.body;

  try {
    // تحديث users
    const { error: uErr } = await supabase
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName,
        email,
      })
      .eq("id", userId);

    if (uErr) {
      console.error("users update error:", uErr);
      return res.status(400).json({ error: "Failed to update user" });
    }

    // لو وصل level → upsert في students على student_id
    if (level !== undefined && level !== null && String(level).trim() !== "") {
      const numericLevel = Number(level); // تأكد أنه رقم 1..8
      const { error: sErr } = await supabase
        .from("students")
        .upsert(
          { student_id: userId, level: numericLevel },
          { onConflict: "student_id" }
        );

      if (sErr) {
        console.error("students upsert error:", sErr);
        return res.status(400).json({ error: "Failed to update student level" });
      }
    }

    return res.json({ message: "Profile updated successfully" });
  } catch (e) {
    console.error("PUT /api/profile error:", e);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
