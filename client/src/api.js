import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000", // عدّلي لو عندك بورت/دومين مختلف
});

// interceptor يضيف Authorization من localStorage تلقائيًا
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
