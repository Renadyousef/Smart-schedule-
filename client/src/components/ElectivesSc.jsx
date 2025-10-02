// src/components/Schedule/ManageElectives.jsx
import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

// Mock Data with numeric levels
const mockElectives = [
  {
    DepartmentID: "Computer Science",
    CourseID: "CS101",
    CourseName: "Introduction to AI",
    Section: 17, // section number
    Level: 3, // level from 3 to 8
    ClassType: "Lecture",
    days: "Monday,Tuesday",
    StartTime: "09:00 AM",
    EndTime: "09:50 AM",
    Room: "101", // classroom number
  },
  {
    DepartmentID: "Data Science",
    CourseID: "DS102",
    CourseName: "Data Science Basics",
    Section: 1,
    Level: 4,
    ClassType: "Lab",
    days: "Wednesday",
    StartTime: "10:00 AM",
    EndTime: "10:50 AM",
    Room: "Lab 3",
  },
  {
    DepartmentID: "Web Development",
    CourseID: "WD201",
    CourseName: "Web Development",
    Section: 2,
    Level: 5,
    ClassType: "Elective",
    days: "Thursday,Friday",
    StartTime: "11:00 AM",
    EndTime: "11:50 AM",
    Room: "202",
  },
  {
    DepartmentID: "Databases",
    CourseID: "DB301",
    CourseName: "Advanced Databases",
    Section: 3,
    Level: 6,
    ClassType: "Core",
    days: "Monday,Wednesday",
    StartTime: "01:00 PM",
    EndTime: "01:50 PM",
    Room: "305",
  },
];

export default function ManageElectives({ electivesData = mockElectives }) {
  const [approvedCourses, setApprovedCourses] = useState([]);

  const handleApprove = (courseID) => {
    if (!approvedCourses.includes(courseID)) {
      setApprovedCourses([...approvedCourses, courseID]);
      alert(`Elective ${courseID} approved!`);
    }
  };

  return (
    <div className="container my-5">
      <h2 className="mb-4 text-center">📚 Electives Offered</h2>
      <div className="row g-4">
        {electivesData.map((e) => (
          <div key={e.CourseID} className="col-md-6 col-lg-4">
            <div className="card shadow-sm h-100 border-0">
              <div className="card-body d-flex flex-column">
                <h5 className="card-title mb-2">{e.CourseID} — {e.CourseName}</h5>
                <p className="card-text mb-2">
                  <strong>Department:</strong> {e.DepartmentID}<br />
                  <strong>Section:</strong> {e.Section}<br />
                  <strong>Level:</strong> {e.Level}<br />
                  <strong>Type:</strong> {e.ClassType}<br />
                  <strong>Days:</strong> {e.days}<br />
                  <strong>Time:</strong> {e.StartTime} - {e.EndTime}<br />
                  <strong>Room:</strong> {e.Room || "TBD"}
                </p>
                <button
                  className={`btn mt-auto ${approvedCourses.includes(e.CourseID) ? "btn-success disabled" : "btn-primary"}`}
                  onClick={() => handleApprove(e.CourseID)}
                >
                  {approvedCourses.includes(e.CourseID) ? "Approved" : "Approve"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
