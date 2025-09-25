import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useState, useEffect, useMemo } from 'react';

import AuthPage      from './components/Auth/AuthPage';
import RegistrarHome from './components/RegistererHome/Home';   // Home.jsx للـ registrar
import SC_Home       from './components/SCHome/SC_Home';        // Schedule Committee
import StudentHome   from './components/StudentHome/StudentHome';
import TLCHomePage   from './components/TLChome/HomePage';      // Teaching Load Committee

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedRole = (localStorage.getItem('role') || '').toLowerCase().trim();
    setIsAuthenticated(!!token);
    setRole(storedRole);
  }, []);

  // خريطة الدور -> الصفحة
  const RoleHome = useMemo(() => {
    const map = {
      registrar: RegistrarHome,
      sc: SC_Home,            // لاحظي: نخزّن 'Sc' كـ lowercase => 'sc'
      student: StudentHome,
      tlc: TLCHomePage,
    };
    return map[role] || StudentHome; // افتراضيًا: registrar
  }, [role]);

  // تسجيل الخروج
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
        // بعد نجاح تسجيل الدخول: نقرأ الدور المخزّن ونحدّث الحالة
        const storedRole = (localStorage.getItem('role') || '').toLowerCase().trim();
        setIsAuthenticated(true);
        setRole(storedRole);
      }}
    />
  );
}

export default App;
