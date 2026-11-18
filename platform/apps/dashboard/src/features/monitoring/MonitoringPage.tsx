import { useQuery } from '@tanstack/react-query';
import { Grid2X2, Grid3X3, MonitorPlay } from 'lucide-react';
import { CameraCanvas } from '../../components/CameraCanvas';
import { Button, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import type { Camera, Zone } from '../../lib/types';
import { useUiStore } from '../../store/ui.store';

export function MonitoringPage() {
  const columns = useUiStore((state) => state.monitoringColumns);
  const setColumns = useUiStore((state) => state.setMonitoringColumns);
  const cameras = useQuery({ queryKey: ['cameras'], queryFn: () => api<Camera[]>('/cameras') });
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/zones') });
  const active = cameras.data?.filter((camera) => camera.enabled) ?? [];

  return (
    <div className="page page--wide">
      <PageHeader
        eyebrow="Live operations"
        title="Live monitoring"
        description="Preview di luar jadwal memakai inference ringan hanya saat halaman ini dibuka."
        action={
          <div className="segmented">
            <Button variant={columns === 1 ? 'primary' : 'ghost'} onClick={() => setColumns(1)}>
              1
            </Button>
            <Button variant={columns === 2 ? 'primary' : 'ghost'} onClick={() => setColumns(2)}>
              <Grid2X2 size={17} />
            </Button>
            <Button variant={columns === 3 ? 'primary' : 'ghost'} onClick={() => setColumns(3)}>
              <Grid3X3 size={17} />
            </Button>
          </div>
        }
      />
      {cameras.isLoading ? (
        <Spinner />
      ) : active.length === 0 ? (
        <EmptyState
          icon={<MonitorPlay />}
          title="Tidak ada kamera aktif"
          description="Aktifkan kamera untuk menampilkannya di ruang monitoring."
        />
      ) : (
        <div
          className="monitor-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {active.map((camera) => (
            <article className="monitor-tile" key={camera._id}>
              <CameraCanvas
                camera={camera}
                zones={zones.data?.filter(
                  (zone) => String(zone.cameraId) === camera._id && zone.enabled,
                )}
              />
              <footer>
                <div>
                  <strong>{camera.name}</strong>
                  <small>{camera.location || 'Lokasi belum diisi'}</small>
                </div>
                <span
                  className={`status-dot status-dot--${camera.runtimeStatus === 'online' ? 'green' : 'amber'}`}
                />
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
