// server/controllers/accountController.js
// قاعدة بيانات مؤقتة في الذاكرة – استبدليها بجدول فعلي لاحقاً
const users = {
  u123: {
    id: "u123",
    role: "student",
    email: "lama@student.edu",
    firstName: "Lama",
    lastName: "Alqahtani",
    department: "Information Technology",
    program: "B.Sc. IT",
    level: "Level 6",
  },
};

exports.getMe = async (req, res) => {
  const me = users[req.user.id];
  if (!me) return res.status(404).json({ error: "User not found" });
  return res.json(me);
};

exports.updateMe = async (req, res) => {
  const me = users[req.user.id];
  if (!me) return res.status(404).json({ error: "User not found" });

  const { firstName, lastName, email, department, program, level } = req.body || {};
  Object.assign(me, {
    ...(firstName !== undefined && { firstName }),
    ...(lastName  !== undefined && { lastName  }),
    ...(email     !== undefined && { email     }),
    ...(department!== undefined && { department}),
    ...(program   !== undefined && { program   }),
    ...(level     !== undefined && { level     }),
  });

  return res.json({ ok: true, me });
};
