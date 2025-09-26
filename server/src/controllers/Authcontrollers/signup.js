import bcrypt from "bcrypt";
import pool from "../../../DataBase_config/DB_config.js";
import jwt from "jsonwebtoken";

// جدول الهدف + العمود الأساسي لكل دور
const roleTarget = {
  student:  { table: `"Students"`,               pk: `"StudentID"` },
  instructor:{ table: `"Instructor"`,            pk: `"InstructorID"` },
  registrar:{ table: `"Registrars"`,             pk: `"RegistrarID"` },
  tlc:      { table: `"TeachingLoadCommittee"`,  pk: `"CommitteeID"` },
  sc:       { table: `"SchedulingCommittee"`,    pk: `"SchedulingCommitteeID"` },
};

// تحويل أي إدخال من الواجهة إلى مفتاح قياسي + قيمة التخزين في عمود Role
function mapRole(input) {
  const raw = String(input || "").trim();
  const lower = raw.toLowerCase();
  const uiToKey = {
    "student": "student",
    "instructor": "instructor",
    "registrar": "registrar",
    "scheduling committee": "sc",
    "teaching load committee": "tlc",
  };
  const key = uiToKey[lower] || lower;   // مفتاح استخدام الجداول
  // قيمة التخزين في عمود "Role" بالضبط كما في قاعدة بياناتك
  const store =
    key === "sc" ? "Sc" :               // <-- ملاحظة: S كبيرة حسب بياناتك
    key;                                 // الباقي كما هو (student/instructor/registrar/tlc)
  return { key, store };
}

export const signup = async (req, res) => {
  const client = await pool.connect();
  try {
    const { firstName, lastName, email, password, role, department } = req.body;

    // موجود مسبقًا؟
    const exists = await pool.query(
      `SELECT 1 FROM "User" WHERE "Email"=$1`,
      [email]
    );
    if (exists.rowCount) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // حوّل الدور
    const { key: roleKey, store: roleValue } = mapRole(role);
    if (!roleTarget[roleKey]) {
      return res.status(400).json({ message: "Invalid role" });
    }

    await client.query("BEGIN");

    // 1) إدراج المستخدم في User (أسماء الأعمدة كما عندك)
    const ins = await client.query(
      `INSERT INTO "User"
       ("First_name","Last_name","Email","Password","Role","DepartmentID")
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING "UserID","Email","Role","DepartmentID"`,
      [firstName, lastName, email, hashedPassword, roleValue, department]
    );
    const user = ins.rows[0];

    // 2) إدراج في جدول الدور بنفس UserID
    const { table, pk } = roleTarget[roleKey];
    await client.query(
      `INSERT INTO ${table} (${pk}) VALUES ($1)
       ON CONFLICT (${pk}) DO NOTHING`,
      [user.UserID]
    );

    await client.query("COMMIT");

    // 3) JWT والرد نفسه
    const token = jwt.sign(
      { id: user.UserID, email: user.Email, role: user.Role },
      process.env.JWT_SECRET
    );
    return res.status(201).json({
      message: "Sign Up successful!",
      token,
      user,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("SIGNUP_ERROR:", error);
    // رجّعي سبب الخطأ للواجهة ليسهل التشخيص
    return res.status(500).json({
      message: "Signup failed",
      error: error?.detail || error?.message,
    });
  } finally {
    client.release();
  }
};
