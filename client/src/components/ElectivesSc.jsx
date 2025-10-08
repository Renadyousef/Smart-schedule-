// src/components/Schedule/ManageElectives.jsx
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";

export default function ManageElectives() {
  const [electivesData, setElectivesData] = useState([]);
  const [approvedCourses, setApprovedCourses] = useState([]);

  // Fetch electives from backend
  useEffect(() => {
    const fetchElectives = async () => {
      try {
        const response = await axios.get("http://localhost:5000/Electives/view");
        // Map backend fields to JS-friendly keys
        const mappedData = response.data.map((e) => ({
          offerid: e.OfferID, // keep for internal use
          departmentname: e.departmentname,
          courseid: e.CourseID,
          coursename: e.coursename,
          section: e.Section,
          classtype: e.ClassType,
          status: e.Status,
          days: e.Days,
          starttime: e.StartTime,
          endtime: e.EndTime,
          offeredat: e.OfferedAt,
        }));
        setElectivesData(mappedData);
      } catch (error) {
        console.error("Error fetching electives:", error);
      }
    };
    fetchElectives();
  }, []);

  // Handle approving an elective
  const handleApprove = async (offerID) => {
    try {
      await axios.put(`http://localhost:5000/Electives/approve/${offerID}`);
      setApprovedCourses((prev) => [...prev, offerID]);
      alert("Elective approved successfully!");
    } catch (error) {
      console.error("Error approving elective:", error);
      alert("Failed to approve elective. Please try again.");
    }
  };

  return (
    <div className="container my-5">
      <h2 className="mb-4 text-center">📚 Electives Offered</h2>
      <div className="row g-4">
        {electivesData.map((e) => (
          <div key={e.offerid} className="col-md-6 col-lg-4">
            <div className="card shadow-sm h-100 border-0">
              <div className="card-body d-flex flex-column">
                <h5 className="card-title mb-2">
                   {e.coursename}
                </h5>
                <p className="card-text mb-2">
                  <strong>Department:</strong> {e.departmentname} <br />
                  <strong>Section:</strong> {e.section} <br />
                  <strong>Type:</strong> {e.classtype} <br />
                  <strong>Status:</strong>{" "}
                  <span
                    className={`badge ${
                      e.status === "Approved" ? "bg-success" : "bg-warning text-dark"
                    }`}
                  >
                    {e.status}
                  </span>
                  <br />
                  <strong>Days:</strong> {e.days || "—"} <br />
                  <strong>Time:</strong> {e.starttime} - {e.endtime} <br />
                  <strong>Offered At:</strong>{" "}
                  {new Date(e.offeredat).toLocaleString()} <br />
                </p>
                <button
                  className={`btn mt-auto ${
                    approvedCourses.includes(e.offerid) || e.status === "Approved"
                      ? "btn-success disabled"
                      : "btn-primary"
                  }`}
                  onClick={() => handleApprove(e.offerid)}
                >
                  {approvedCourses.includes(e.offerid) || e.status === "Approved"
                    ? "Approved"
                    : "Approve"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {electivesData.length === 0 && (
          <p className="text-center text-muted">No electives available.</p>
        )}
      </div>
    </div>
  );
}
