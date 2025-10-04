// Validate a single email
export function validateEmail(email) {
  if (!email) return "Email is required";

  // Basic email format check
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) return "Invalid email format. Example: user@ksu.edu.sa";

  // Must be a KSU email
  if (!email.endsWith("@student.ksu.edu.sa") && !email.endsWith("@ksu.edu.sa")) {
    return "Email must be your KSU email (student: @student.ksu.edu.sa, faculty/staff: @ksu.edu.sa)";
  }

  return ""; // valid
}


// Suggest role based on email
export function getRoleByEmail(email) {
  if (email.endsWith("@student.ksu.edu.sa")) return "student";  // auto student
  if (email.endsWith("@ksu.edu.sa")) return ""; // faculty/staff: user picks
  return ""; // unknown, let user pick
}

// Validate a single password (stronger)
export function validatePassword(password) {
  if (!password) return "Password is required";
  const strongPwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPwdRegex.test(password))
    return "Password must be at least 8 characters, include uppercase, lowercase, number, and special character";
  return "";
}

// Validate a single name (first or last)
export function validateName(name) {
  if (!name) return "This field is required";
  if (!/^[A-Za-z]+$/.test(name)) return "Name must contain only letters";
  return "";
}

// Validate a dropdown (role or department)
export function validateDropdown(value) {
  if (!value) return "This field is required";
  return "";
}
