import { useEffect, useState } from "react";
import axios from "axios";
import { Bar, Line, Pie } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js/auto";
import API from "../../API_continer"; // ✅ use same axios instance

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await API.get(`/api/dashboard`);

        setData(res.data);
      } catch (err) {
        console.error("Dashboard fetch failed:", err);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3 text-muted">Loading charts...</p>
      </div>
    );

  if (error) return <p className="text-danger text-center mt-4">{error}</p>;
  if (!data) return <p className="text-center mt-4">No data available.</p>;

  // ✅ Filter out null levels
  const filteredLevels = data.levelStats.filter((l) => l.Level !== null);

  // 🎯 Pie Chart (Status)
  const pieData = {
    labels: data.statusStats.map((s) => s.status || "Unknown"),
    datasets: [
      {
        data: data.statusStats.map((s) => s.count),
        backgroundColor: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f"],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  // 📊 Bar Chart (Levels)
  const barData = {
    labels: filteredLevels.map((l) => `Level ${l.Level}`),
    datasets: [
      {
        label: "Schedules per Level",
        data: filteredLevels.map((l) => l.count),
        backgroundColor: "rgba(54,162,235,0.7)",
        borderColor: "rgba(54,162,235,1)",
        borderWidth: 2,
        borderRadius: 10,
      },
    ],
  };

  // 📈 Line Chart (Weekly trend)
  const lineData = {
    labels: data.weeklyStats.map((w) => `W${w.week}`),
    datasets: [
      {
        label: "Schedules Created per Week",
        data: data.weeklyStats.map((w) => w.count),
        fill: false,
        borderColor: "#36A2EB",
        backgroundColor: "#4e79a7",
        pointBackgroundColor: "#4e79a7",
        tension: 0.4,
      },
    ],
  };

  // 🎨 Chart options
  const options = {
    plugins: {
      legend: {
        position: "bottom",
        labels: { font: { size: 12 } },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="container py-5">
      <h2 className="text-center mb-5 fw-bold text-dark">Scheduler Dashboard</h2>

      <div className="row g-4">
        {/* Pie */}
        <div className="col-md-4">
          <div className="card shadow-sm p-3 rounded-4">
            <h5 className="text-center mb-3 text-secondary">
              Schedule Status Distribution
            </h5>
            <div style={{ height: "300px" }}>
              <Pie data={pieData} options={options} />
            </div>
          </div>
        </div>

        {/* Bar */}
        <div className="col-md-4">
          <div className="card shadow-sm p-3 rounded-4">
            <h5 className="text-center mb-3 text-secondary">Most Active Levels</h5>
            <div style={{ height: "300px" }}>
              <Bar data={barData} options={options} />
            </div>
          </div>
        </div>

        {/* Line */}
        <div className="col-md-4">
          <div className="card shadow-sm p-3 rounded-4">
            <h5 className="text-center mb-3 text-secondary">Weekly Schedule Load</h5>
            <div style={{ height: "300px" }}>
              <Line data={lineData} options={options} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
