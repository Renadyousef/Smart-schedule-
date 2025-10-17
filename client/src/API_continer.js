// client/components/API_continer.js
//this helps with the full paths requests localhost:5000 issue for docker as its on local host only
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // uses env variable
});

export default API;
