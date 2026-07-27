import { useState, useEffect } from 'react';
import Login from './views/Login';
import { Dashboard } from './views/Dashboard';
import { ManageStation } from './views/ManageStation';
import UserManagement from './views/UserManagement';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const [selectedPumpId, setSelectedPumpId] = useState<number | null>(null);
  const [viewingUsers, setViewingUsers] = useState(false);

  useEffect(() => {
    const forceScrollToTop = () => {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      setTimeout(() => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 150);
    };
    forceScrollToTop();
  }, [selectedPumpId, isAuthenticated, viewingUsers]);

  if (!isAuthenticated) {
    return <Login />;
  }

  if (viewingUsers && user?.role === 'super_admin') {
    return (
      <UserManagement 
        onBack={() => {
          setViewingUsers(false);
          setSelectedPumpId(null);
        }} 
        onLogout={logout} 
      />
    );
  }

  if (selectedPumpId !== null) {
    return (
      <ManageStation
        pumpId={selectedPumpId}
        onBack={() => setSelectedPumpId(null)}
        onLogout={() => {
          logout();
          setSelectedPumpId(null);
        }}
        onManageUsers={user?.role === 'super_admin' ? () => setViewingUsers(true) : undefined}
      />
    );
  }

  return (
    <Dashboard
      onSelectPump={setSelectedPumpId}
      onLogout={logout}
      onManageUsers={user?.role === 'super_admin' ? () => setViewingUsers(true) : undefined}
    />
  );
}

export default App;
