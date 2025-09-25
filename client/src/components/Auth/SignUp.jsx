import { useState } from "react";
import { validateEmail, validatePassword, validateName, validateDropdown } from "./validations";
import axios from "axios";
import DepartmentDropdown from "./Departments";

export default function SignUp({ onLogin }) {
  const [inputs, setInputs] = useState({
    firstName: "",
    lastName: "",
    role: "",
    department: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { id, value } = e.target;
    setInputs((prev) => ({ ...prev, [id]: value }));
  };

  const handleBlur = (e) => {
    const { id, value } = e.target;
    let error = "";

    switch (id) {
      case "firstName":
      case "lastName":
        error = validateName(value); break;
      case "role":
      case "department":
        error = validateDropdown(value); break;
      case "email":
        error = validateEmail(value); break;
      case "password":
        error = validatePassword(value); break;
      default: break;
    }
    setErrors((prev) => ({ ...prev, [id]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation
    const allErrors = {
      firstName: validateName(inputs.firstName),
      lastName: validateName(inputs.lastName),
      role: validateDropdown(inputs.role),
      department: validateDropdown(inputs.department),
      email: validateEmail(inputs.email),
      password: validatePassword(inputs.password),
    };

    setErrors(allErrors);
    if (!Object.values(allErrors).every((err) => !err)) {
      alert("Please fix errors before submitting.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:5000/auth/signup", inputs);

      const token = res?.data?.token;
      const roleFromApi =
        res?.data?.role ||
        res?.data?.user?.role ||
        inputs.role; // fallback على اختيار المستخدم

      if (token) localStorage.setItem("token", token);
      if (roleFromApi) localStorage.setItem("role", String(roleFromApi).toLowerCase());

      alert("User signed up successfully!");
      if (onLogin) onLogin();

      setInputs({
        firstName: "",
        lastName: "",
        role: "",
        department: "",
        email: "",
        password: "",
      });
      setErrors({});
    } catch (err) {
      if (err.response) {
        alert(err.response.data.message || "Server error.");
      } else {
        alert("Could not connect to backend.");
      }
    }
  };

  return (
    <form className="p-4" onSubmit={handleSubmit}>
      {/* First Name */}
      <div className="mb-3">
        <label htmlFor="firstName">First Name</label>
        <input
          type="text"
          id="firstName"
          className="form-control"
          value={inputs.firstName}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.firstName && <small className="text-danger">{errors.firstName}</small>}
      </div>

      {/* Last Name */}
      <div className="mb-3">
        <label htmlFor="lastName">Last Name</label>
        <input
          type="text"
          id="lastName"
          className="form-control"
          value={inputs.lastName}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.lastName && <small className="text-danger">{errors.lastName}</small>}
      </div>

      {/* Role */}
      <div className="mb-3">
        <label htmlFor="role">Role</label>
        <select
          id="role"
          className="form-select"
          value={inputs.role}
          onChange={handleChange}
          onBlur={handleBlur}
        >
          <option value="">Select your role</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="Sc">Schudling Committee</option>
          <option value="tlc">Teaching Load Committee</option>
          <option value="registrar">Registrar</option>
        </select>
        {errors.role && <small className="text-danger">{errors.role}</small>}
      </div>

      {/* Department */}
      <div className="mb-3">
        <label htmlFor="department">Department</label>
        <DepartmentDropdown
          onSelect={(depId) => setInputs((prev) => ({ ...prev, department: depId }))}
        />
        {errors.department && <small className="text-danger">{errors.department}</small>}
      </div>

      {/* Email */}
      <div className="mb-3">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          className="form-control"
          value={inputs.email}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.email && <small className="text-danger">{errors.email}</small>}
      </div>

      {/* Password */}
      <div className="mb-3">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          className="form-control"
          value={inputs.password}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.password && <small className="text-danger">{errors.password}</small>}
      </div>

      <button type="submit" className="btn btn-primary w-100">Sign Up</button>
    </form>
  );
}
