import { create } from 'zustand';
import { UserRole, type DemoState } from '../types';

type Tab = 'command-center' | 'station' | 'link' | 'scenarios' | 'decisions' | 'commands' | 'inventory';

interface UIStore {
  activeTab: Tab;
  role: UserRole;
  selectedModule: string | null;
  demo: DemoState;
  sidebarOpen: boolean;
  
  setActiveTab: (tab: Tab) => void;
  setRole: (role: UserRole) => void;
  setSelectedModule: (id: string | null) => void;
  setDemo: (demo: Partial<DemoState>) => void;
  toggleSidebar: () => void;
  resetUI: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: 'command-center',
  role: UserRole.HQ_COMMAND,
  selectedModule: null,
  demo: {
    running: false,
    step: 0,
    totalSteps: 16,
    currentPhase: 'Idle',
    error: undefined,
    paused: false,
  },
  sidebarOpen: false,
  
  setActiveTab: (activeTab) => set({ activeTab }),
  setRole: (role) => set({ role }),
  setSelectedModule: (selectedModule) => set({ selectedModule }),
  setDemo: (demo) => set((s) => ({ demo: { ...s.demo, ...demo } })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  resetUI: () => set({
    activeTab: 'command-center',
    selectedModule: null,
    demo: { running: false, step: 0, totalSteps: 16, currentPhase: 'Idle', error: undefined, paused: false },
  }),
}));

export type { Tab };
