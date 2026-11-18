import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UiState = {
  sidebarCollapsed: boolean;
  monitoringColumns: 1 | 2 | 3;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMonitoringColumns: (columns: 1 | 2 | 3) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      monitoringColumns: 2,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMonitoringColumns: (monitoringColumns) => set({ monitoringColumns }),
    }),
    { name: 'sentinel-ui' },
  ),
);
