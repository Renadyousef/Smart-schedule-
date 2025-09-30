import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useState, useEffect, useMemo } from 'react';

import AuthPage       from './components/Auth/AuthPage';
import RegistrarHome  from './components/RegistererHome/Home';
import SC_Home        from './components/SCHome/SC_Home';
import StudentHome    from './components/StudentHome/StudentHome';
import TLCHomePage    from './components/TLChome/HomePage';
import InstructorHome from './components/Instructor/InstructorHome';

// ✅ صفحات البروفايل
import SCProfileEN          from "./components/Profiles/SCProfileEN.jsx"; 
import RegistrarProfile     from "./components/Profiles/RegistrarProfile.jsx";
import SCCommitteeProfile   from "./components/Profiles/SCCommitteeProfile.jsx";
import TLCProfile           from "./components/Profiles/TLCProfile.jsx";
import InstructorProfile    from "./components/Profiles/InstructorProfile.jsx";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedRole = (localStorage.getItem('role') || '').toLowerCase().trim();
    setIsAuthenticated(!!token);
    setRole(storedRole);
  }, []);

  // الصفحات الرئيسية
  const RoleHome = useMemo(() => {
    const map = {
      registrar: RegistrarHome,
      registerer: RegistrarHome,   // 👈 أضفتها لو مخزّن كذا
      sc: SC_Home,
      student: StudentHome,
      tlc: TLCHomePage,
      instructor: InstructorHome,
    };
    return map[role] || StudentHome;
  }, [role]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setIsAuthenticated(false);
    setRole('');
  };

  return isAuthenticated ? (
    <RoleHome onLogout={handleLogout} />
  ) : (
    <AuthPage
      onLogin={() => {
        const storedRole = (localStorage.getItem('role') || '').toLowerCase().trim();
        setIsAuthenticated(true);
        setRole(storedRole);
      }}
    />
  );
}

export default App;
