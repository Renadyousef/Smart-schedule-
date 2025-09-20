import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useState, useEffect } from 'react';
import AuthPage from './components/Auth/AuthPage';
import WelcomePage from './components/Auth/welcomePage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token); // true if token exists
  }, []);

  return isAuthenticated ? <WelcomePage /> : <AuthPage />;
}

export default App;
