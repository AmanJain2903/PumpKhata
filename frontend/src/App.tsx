import { useState, useEffect } from 'react';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { ManageStation } from './views/ManageStation';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedPumpId, setSelectedPumpId] = useState<number | null>(null);

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
  }, [selectedPumpId, isLoggedIn]);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (selectedPumpId !== null) {
    return (
      <ManageStation
        pumpId={selectedPumpId}
        onBack={() => setSelectedPumpId(null)}
        onLogout={() => {
          setIsLoggedIn(false);
          setSelectedPumpId(null);
        }}
      />
    );
  }

  return (
    <Dashboard
      onSelectPump={setSelectedPumpId}
      onLogout={() => {
        setIsLoggedIn(false);
      }}
    />
  );
}

export default App;
