export default function SignIn() {
  return (
    <form className="p-4 border rounded shadow-sm bg-light">
      <h3 className="mb-4 text-center">Sign Up</h3>

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
        Sign In
      </button>
    </form>
  );
}
