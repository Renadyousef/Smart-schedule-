import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useState, useEffect } from 'react';
import AuthPage from './components/Auth/AuthPage';
import WelcomePage from './components/Auth/welcomePage';
import HomePage from './components/TLChome/HomePage';
import SC_Home from './components/SCHome/SC_Home';
import StudentHome from './components/StudentHome/StudentHome';
import Home from './components/RegistererHome/Home';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token); // true if token exists
  }, []);

  return isAuthenticated ? <Home /> : <AuthPage onLogin={() => setIsAuthenticated(true)} />;
}

export default App;
