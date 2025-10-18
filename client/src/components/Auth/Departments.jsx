import { useEffect, useState } from "react";
import axios from "axios";
import API from "../../API_continer"; 

export default function DepartmentDropdown({ onSelect }) {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    API.get("/api/")
      .then((res) => {
        setDepartments(res.data);
        console.log(departments);

      })
      .catch((err) => {
        console.error("Error fetching departments:", err);
      });
  }, []);

  return (
    <select className="form-select text-dark" onChange={(e) => onSelect(e.target.value)}>
      <option value="">Select your department</option>
      {departments.map((dep) => (
        <option key={dep.DepartmentID} value={dep.DepartmentID} className="text-dark">
          {dep.Name}
        </option>
      ))}
    </select>
  );
}
