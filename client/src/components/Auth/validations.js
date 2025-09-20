// validation.js

// Validate a single email
export function validateEmail(email) {
  if (!email) return "Email is required";
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) return "Invalid email format";
  return "";
}

// Validate a single password (stronger)
export function validatePassword(password) {
  if (!password) return "Password is required";
  // Strong password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
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
