import { useQuery } from '@tanstack/react-query';
import { Activity, Camera, CircleAlert, ScanLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import type { Camera as CameraType, DetectionEvent } from '../../lib/types';

const statusTone = (status: string) => {
  if (status === 'online') return 'success' as const;
  if (status === 'error') return 'danger' as const;
  if (status === 'reconnecting' || status === 'connecting') return 'warning' as const;
  return 'neutral' as const;
};

export function OverviewPage() {
  const cameras = useQuery({ queryKey: ['cameras'], queryFn: () => api<CameraType[]>('/cameras') });
  const summary = useQuery({
    queryKey: ['event-summary'],
    queryFn: () => api<{ last24Hours: number; processing: number }>('/events/summary'),
  });
  const events = useQuery({
    queryKey: ['events', 'recent'],
    queryFn: () => api<{ items: DetectionEvent[] }>('/events?limit=6'),
  });
  const online = cameras.data?.filter((camera) => camera.runtimeStatus === 'online').length ?? 0;
  const errors = cameras.data?.filter((camera) => camera.runtimeStatus === 'error').length ?? 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations overview"
        title="Selamat datang kembali"
        description="Pantau kondisi kamera dan kejadian penting tanpa memenuhi layar dengan informasi yang tidak perlu."
      />
      <section className="stat-grid">
        <Card className="stat-card">
          <span className="stat-card__icon">
            <Camera />
          </span>
          <div>
            <small>Kamera online</small>
            <strong>
              {online}
              <em> / {cameras.data?.length ?? 0}</em>
            </strong>
          </div>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__icon stat-card__icon--teal">
            <ScanLine />
          </span>
          <div>
            <small>Deteksi 24 jam</small>
            <strong>{summary.data?.last24Hours ?? 0}</strong>
          </div>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__icon stat-card__icon--amber">
            <Activity />
          </span>
          <div>
            <small>Sedang diproses</small>
            <strong>{summary.data?.processing ?? 0}</strong>
          </div>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__icon stat-card__icon--red">
            <CircleAlert />
          </span>
          <div>
            <small>Perlu perhatian</small>
            <strong>{errors}</strong>
          </div>
        </Card>
      </section>

      <div className="overview-grid">
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fleet health</span>
              <h2>Status kamera</h2>
            </div>
            <Link to="/cameras">Kelola kamera →</Link>
          </div>
          {cameras.isLoading ? (
            <Spinner />
          ) : (
            <div className="camera-health-list">
              {cameras.data?.slice(0, 7).map((camera) => (
                <div className="camera-health-row" key={camera._id}>
                  <span
                    className={`status-dot status-dot--${camera.runtimeStatus === 'online' ? 'green' : camera.runtimeStatus === 'error' ? 'red' : 'amber'}`}
                  />
                  <div>
                    <strong>{camera.name}</strong>
                    <small>{camera.location || 'Lokasi belum diisi'}</small>
                  </div>
                  <Badge tone={statusTone(camera.runtimeStatus)}>{camera.runtimeStatus}</Badge>
                </div>
              ))}
              {!cameras.data?.length && <p className="muted">Belum ada kamera.</p>}
            </div>
          )}
        </Card>
        <Card>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Latest activity</span>
              <h2>Kejadian terbaru</h2>
            </div>
            <Link to="/events">Lihat semua →</Link>
          </div>
          {events.isLoading ? (
            <Spinner />
          ) : (
            <div className="activity-list">
              {events.data?.items.map((event) => {
                const camera = typeof event.cameraId === 'string' ? null : event.cameraId;
                const zone = typeof event.zoneId === 'string' ? null : event.zoneId;
                return (
                  <div className="activity-row" key={event.eventId}>
                    <span className="activity-row__time">
                      {new Date(event.occurredAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div>
                      <strong>{camera?.name ?? 'Kamera'}</strong>
                      <small>{zone?.name ?? event.trigger}</small>
                    </div>
                    <Badge tone={event.status === 'failed' ? 'danger' : 'info'}>
                      {event.status}
                    </Badge>
                  </div>
                );
              })}
              {!events.data?.items.length && <p className="muted">Belum ada kejadian deteksi.</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
