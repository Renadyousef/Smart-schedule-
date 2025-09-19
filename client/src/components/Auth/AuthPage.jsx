import AuthNav from "./authNav";
import SignUp from "./SignUp";
import Footer from "../Footer/Footer";
import SignIn from "./SignIn";

export default function AuthPage() {
  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar */}
      <AuthNav />

      {/* Main content */}
      <main className="container my-5 flex-grow-1">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <SignUp />
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
