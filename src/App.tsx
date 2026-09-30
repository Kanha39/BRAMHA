import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { CommandCenter } from './pages/CommandCenter';
import { StationView } from './pages/StationView';
import { LinkSimulator } from './pages/LinkSimulator';
import { ScenariosPage } from './pages/ScenariosPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { CommandsPage } from './pages/CommandsPage';
import { InventoryPage } from './pages/InventoryPage';
import { useUIStore } from './store/uiStore';
import { useSimulationStore } from './store/simulationStore';
import { tickStation } from './simulation/stationSimulator';
import { tickCommunication } from './communication/commEngine';

function App() {
  const activeTab = useUIStore((s) => s.activeTab);

  // Main simulation loop
  useEffect(() => {
    // We always want to run the loop for the demo/simulation to work,
    // but we can pause it by setting running=false in the store.
    const interval = setInterval(() => {
      const isRunning = useSimulationStore.getState().running;
      if (isRunning) {
        tickStation();
        tickCommunication();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0a0f1a]">
        {activeTab === 'command-center' && <CommandCenter />}
        {activeTab === 'station' && <StationView />}
        {activeTab === 'link' && <LinkSimulator />}
        {activeTab === 'scenarios' && <ScenariosPage />}
        {activeTab === 'decisions' && <DecisionsPage />}
        {activeTab === 'commands' && <CommandsPage />}
        {activeTab === 'inventory' && <InventoryPage />}
      </main>
    </div>
  );
}

export default App;
