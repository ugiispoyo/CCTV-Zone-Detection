import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera as CameraIcon, MapPin, MoreHorizontal, Plus, Radio, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Spinner } from '../../components/ui';
import { api, json } from '../../lib/api';
import type { Camera } from '../../lib/types';
import { CameraForm, type CameraInput } from './CameraForm';

export function CamerasPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Camera | 'new' | null>(null);
  const cameras = useQuery({ queryKey: ['cameras'], queryFn: () => api<Camera[]>('/cameras') });
  const save = useMutation({
    mutationFn: ({ camera, input }: { camera?: Camera; input: CameraInput }) => {
      const payload = { ...input } as CameraInput;
      if (camera && !payload.rtspUrl) delete payload.rtspUrl;
      return api<Camera>(
        camera ? `/cameras/${camera._id}` : '/cameras',
        json(camera ? 'PATCH' : 'POST', payload),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setEditing(null);
    },
  });
  const toggle = useMutation({
    mutationFn: (camera: Camera) =>
      api(`/cameras/${camera._id}/enabled`, json('PUT', { enabled: !camera.enabled })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
  const remove = useMutation({
    mutationFn: (camera: Camera) => api(`/cameras/${camera._id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Configuration"
        title="Kamera & zona"
        description="Kelola sumber RTSP, jadwal deteksi, preview ringan, dan zona setiap kamera."
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus size={17} /> Tambah kamera
          </Button>
        }
      />
      {cameras.isLoading ? (
        <Spinner />
      ) : cameras.data?.length === 0 ? (
        <EmptyState
          icon={<CameraIcon />}
          title="Belum ada kamera"
          description="Tambahkan RTSP pertama untuk mulai membuat zona deteksi."
        />
      ) : (
        <div className="camera-card-grid">
          {cameras.data?.map((camera) => (
            <Card className="camera-card" key={camera._id}>
              <div className="camera-card__visual">
                <span className="camera-card__grid" />
                <CameraIcon size={28} />
                <Badge tone={camera.enabled ? 'success' : 'neutral'}>
                  {camera.enabled ? camera.runtimeStatus : 'inactive'}
                </Badge>
              </div>
              <div className="camera-card__body">
                <div className="camera-card__title">
                  <div>
                    <h2>{camera.name}</h2>
                    <span>
                      <MapPin size={14} /> {camera.location || 'Lokasi belum diisi'}
                    </span>
                  </div>
                  <Button variant="ghost" title="Edit" onClick={() => setEditing(camera)}>
                    <MoreHorizontal size={19} />
                  </Button>
                </div>
                <p className="camera-card__url">{camera.rtspUrlMasked}</p>
                <div className="camera-card__meta">
                  <span>
                    <Radio size={15} /> {camera.schedule.enabled ? 'Terjadwal' : '24 jam'}
                  </span>
                  <span>
                    <ScanLine size={15} /> {camera.preview.inferenceFps} FPS preview
                  </span>
                </div>
              </div>
              <footer className="camera-card__actions">
                <Link className="button button--secondary" to={`/cameras/${camera._id}/zones`}>
                  Atur zona
                </Link>
                <Button variant="ghost" onClick={() => toggle.mutate(camera)}>
                  {camera.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button
                  variant="ghost"
                  className="danger-text"
                  onClick={() => {
                    if (confirm(`Hapus ${camera.name}? Zona kamera juga akan dihapus.`))
                      remove.mutate(camera);
                  }}
                >
                  Hapus
                </Button>
              </footer>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Tambah kamera' : 'Edit kamera'}
          subtitle="RTSP hanya dikonsumsi service internal dan tidak dikirim ke browser."
          onClose={() => setEditing(null)}
        >
          <CameraForm
            camera={editing === 'new' ? undefined : editing}
            busy={save.isPending}
            error={save.error instanceof Error ? save.error.message : undefined}
            onCancel={() => setEditing(null)}
            onSubmit={(input) =>
              save.mutate({ camera: editing === 'new' ? undefined : editing, input })
            }
          />
        </Modal>
      )}
    </div>
  );
}
