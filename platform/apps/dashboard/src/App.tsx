import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CamerasPage } from './features/cameras/CamerasPage';
import { EventsPage } from './features/events/EventsPage';
import { MonitoringPage } from './features/monitoring/MonitoringPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { TelegramPage } from './features/telegram/TelegramPage';
import { ZoneEditorPage } from './features/zones/ZoneEditorPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="cameras" element={<CamerasPage />} />
        <Route path="cameras/:cameraId/zones" element={<ZoneEditorPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="telegram" element={<TelegramPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
