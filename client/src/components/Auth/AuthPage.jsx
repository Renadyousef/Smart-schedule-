import { useState } from "react";
import AuthNav from "./authNav";
import SignUp from "./SignUp";
import SignIn from "./SignIn";
import Footer from "../Footer/Footer";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("signin"); // "signup" or "signin"

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar */}
      <AuthNav />

      {/* Main content */}
      <main className="container my-5 flex-grow-1">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="card shadow">
              
              {/* Toggle Tabs */}
              <div className="d-flex">
                <div
                  className={`flex-fill text-center py-2 ${activeTab === "signup" ? "bg-primary text-white fw-bold" : "bg-light text-muted"}`}
                  style={{ cursor: "pointer", borderBottom: activeTab === "signup" ? "3px solid #0d6efd" : "1px solid #dee2e6" }}
                  onClick={() => setActiveTab("signup")}
                >
                  Sign Up
                </div>
                <div
                  className={`flex-fill text-center py-2 ${activeTab === "signin" ? "bg-primary text-white fw-bold" : "bg-light text-muted"}`}
                  style={{ cursor: "pointer", borderBottom: activeTab === "signin" ? "3px solid #0d6efd" : "1px solid #dee2e6" }}
                  onClick={() => setActiveTab("signin")}
                >
                  Sign In
                </div>
              </div>

              {/* Form */}
              <div className="p-4">
                {activeTab === "signup" ? <SignUp /> : <SignIn />}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
