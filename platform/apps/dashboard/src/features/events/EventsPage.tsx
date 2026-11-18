import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ImageOff, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, Modal, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import type { Camera, DetectionEvent, Zone } from '../../lib/types';

const labelOf = (value: Camera | Zone | string) => (typeof value === 'string' ? '—' : value.name);

export function EventsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState('');
  const cameras = useQuery({ queryKey: ['cameras'], queryFn: () => api<Camera[]>('/cameras') });
  const events = useQuery({
    queryKey: ['events', cameraId],
    queryFn: () =>
      api<{ items: DetectionEvent[]; total: number }>(
        `/events?limit=48${cameraId ? `&cameraId=${cameraId}` : ''}`,
      ),
  });
  const detail = useQuery({
    queryKey: ['event', selected],
    queryFn: () => api<DetectionEvent>(`/events/${selected}`),
    enabled: Boolean(selected),
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Detection archive"
        title="Kejadian"
        description="Tinjau gambar, klip, waktu, kamera, dan zona dari setiap target terdeteksi."
        action={
          <label className="filter-select">
            <span>Kamera</span>
            <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
              <option value="">Semua kamera</option>
              {cameras.data?.map((camera) => (
                <option key={camera._id} value={camera._id}>
                  {camera.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      {events.isLoading ? (
        <Spinner />
      ) : !events.data?.items.length ? (
        <EmptyState
          icon={<ScanLine />}
          title="Belum ada kejadian"
          description="Event tampil setelah person, mobil, motor, atau kepala memasuki line atau zona."
        />
      ) : (
        <div className="event-grid">
          {events.data.items.map((event) => (
            <Card
              className="event-card"
              key={event.eventId}
              onClick={() => setSelected(event.eventId)}
            >
              <div className="event-card__media">
                <ImageOff size={22} />
                <span>Media tersimpan di R2</span>
              </div>
              <div className="event-card__body">
                <div>
                  <strong>{labelOf(event.cameraId)}</strong>
                  <small>{event.objectType} · {labelOf(event.zoneId)}</small>
                </div>
                <Badge
                  tone={
                    event.status === 'failed'
                      ? 'danger'
                      : event.status === 'notified'
                        ? 'success'
                        : 'info'
                  }
                >
                  {event.status}
                </Badge>
              </div>
              <footer>
                <CalendarDays size={14} />{' '}
                {new Date(event.occurredAt).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'medium',
                })}
                <span>{(event.confidence * 100).toFixed(0)}%</span>
              </footer>
            </Card>
          ))}
        </div>
      )}
      {selected && (
        <Modal title="Detail kejadian" subtitle={selected} onClose={() => setSelected(null)}>
          {detail.isLoading ? (
            <Spinner />
          ) : (
            detail.data && (
              <div className="event-detail">
                <div className="media-gallery">
                  {(['face', 'body', 'frame'] as const).map((kind) =>
                    detail.data?.mediaUrls?.[kind] ? (
                      <figure key={kind}>
                        <img src={detail.data.mediaUrls[kind]} alt={kind} />
                        <figcaption>{kind}</figcaption>
                      </figure>
                    ) : (
                      <figure className="media-missing" key={kind}>
                        <ImageOff />
                        <figcaption>{kind} tidak tersedia</figcaption>
                      </figure>
                    ),
                  )}
                </div>
                {detail.data.mediaUrls?.clip && (
                  <video className="event-video" src={detail.data.mediaUrls.clip} controls />
                )}
              </div>
            )
          )}
        </Modal>
      )}
    </div>
  );
}
