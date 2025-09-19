export default function SignUp() {
  return (
    <form className="p-4">
     
 {/* First & Last Name */}
      <div className="mb-3">
        <label htmlFor="firstName" className="form-label">
          First Name
        </label>
        <input type="text" id="firstName" className="form-control" placeholder="First Name" />
      </div>
      <div className="mb-3">
        <label htmlFor="lastName" className="form-label">
          Last Name
        </label>
        <input type="text" id="lastName" className="form-control" placeholder="Last Name" />
      </div>
      {/* Role selection */}
      <div className="mb-3">
        <label htmlFor="role" className="form-label">
          Role
        </label>
        <select id="role" className="form-select">
          <option value="">Select your role</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="tlc">Teaching Load Committee</option>
          <option value="registrar">Registrar</option>
        </select>
      </div>

      {/* Department */}
      <div className="mb-3">
        <label htmlFor="department" className="form-label">
          Department
        </label>
        <select id="department" className="form-select">
          <option value="">Select your department</option>
          <option value="cs">Computer Science</option>
          <option value="math">Mathematics</option>
          <option value="physics">Physics</option>
          {/* Add more departments as needed */}
        </select>
      </div>

     

      {/* Email */}
      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input type="email" id="email" className="form-control" placeholder="Email" />
      </div>

      {/* Password */}
      <div className="mb-3">
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <input type="password" id="password" className="form-control" placeholder="Password" />
      </div>

      {/* Submit Button */}
      <button type="submit" className="btn btn-primary w-100">
        Sign Up
      </button>
    </form>
  );
}
