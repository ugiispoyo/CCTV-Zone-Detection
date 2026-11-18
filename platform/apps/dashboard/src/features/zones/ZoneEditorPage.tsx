import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MousePointer2, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CameraCanvas } from '../../components/CameraCanvas';
import { ScheduleEditor } from '../../components/ScheduleEditor';
import { Badge, Button, Card, PageHeader, Spinner } from '../../components/ui';
import { api, json } from '../../lib/api';
import type { Camera, Point, Schedule, Zone } from '../../lib/types';

const defaultSchedule: Schedule = {
  enabled: true,
  days: [1, 2, 3, 4, 5],
  windows: [{ start: '08:00', end: '17:00' }],
};

export function ZoneEditorPage() {
  const { cameraId = '' } = useParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'line' | 'polygon'>('line');
  const [points, setPoints] = useState<Point[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'inherit' | 'custom'>('inherit');
  const [schedule, setSchedule] = useState(defaultSchedule);
  const camera = useQuery({
    queryKey: ['camera', cameraId],
    queryFn: () => api<Camera>(`/cameras/${cameraId}`),
  });
  const zones = useQuery({
    queryKey: ['zones', cameraId],
    queryFn: () => api<Zone[]>(`/zones?cameraId=${cameraId}`),
  });
  const create = useMutation({
    mutationFn: () =>
      api(
        '/zones',
        json('POST', {
          cameraId,
          name,
          kind,
          points,
          enabled: true,
          scheduleMode,
          schedule: scheduleMode === 'custom' ? schedule : undefined,
          direction: 'both',
        }),
      ),
    onSuccess: () => {
      setName('');
      setPoints([]);
      void queryClient.invalidateQueries({ queryKey: ['zones', cameraId] });
    },
  });
  const update = useMutation({
    mutationFn: ({ zone, input }: { zone: Zone; input: Partial<Zone> }) =>
      api(`/zones/${zone._id}`, json('PATCH', input)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['zones', cameraId] }),
  });
  const remove = useMutation({
    mutationFn: (zone: Zone) => api(`/zones/${zone._id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['zones', cameraId] }),
  });
  const maxPoints = kind === 'line' ? 2 : 12;
  const addPoint = (point: Point) => {
    if (points.length < maxPoints) setPoints((current) => [...current, point]);
  };
  const canSave = name.trim() && (kind === 'line' ? points.length === 2 : points.length >= 3);

  if (camera.isLoading || zones.isLoading)
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  if (!camera.data)
    return (
      <div className="page">
        <p>Kamera tidak ditemukan.</p>
      </div>
    );

  return (
    <div className="page page--wide">
      <Link to="/cameras" className="back-link">
        <ArrowLeft size={16} /> Kembali ke kamera
      </Link>
      <PageHeader
        eyebrow="Zone designer"
        title={camera.data.name}
        description="Klik langsung pada preview. Koordinat disimpan secara relatif agar tetap akurat pada resolusi berbeda."
      />
      <div className="zone-editor-layout">
        <div className="zone-editor-canvas">
          <CameraCanvas camera={camera.data} zones={zones.data} draft={points} onPoint={addPoint} />
          <div className="canvas-hint">
            <MousePointer2 size={16} />{' '}
            {kind === 'line'
              ? 'Pilih tepat 2 titik untuk membuat line'
              : 'Pilih minimal 3 titik untuk membuat polygon'}
            <Button variant="ghost" onClick={() => setPoints([])}>
              <RotateCcw size={15} /> Reset
            </Button>
          </div>
        </div>
        <aside className="zone-panel">
          <Card>
            <div className="section-heading">
              <div>
                <span className="eyebrow">New geometry</span>
                <h2>Zona baru</h2>
              </div>
              <Badge tone="info">{points.length} titik</Badge>
            </div>
            <div className="form-stack compact">
              <label className="field">
                <span>Nama zona</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Area pintu masuk"
                />
              </label>
              <div className="segmented full">
                <Button
                  variant={kind === 'line' ? 'primary' : 'ghost'}
                  onClick={() => {
                    setKind('line');
                    setPoints([]);
                  }}
                >
                  Line
                </Button>
                <Button
                  variant={kind === 'polygon' ? 'primary' : 'ghost'}
                  onClick={() => {
                    setKind('polygon');
                    setPoints([]);
                  }}
                >
                  Polygon
                </Button>
              </div>
              <label className="field">
                <span>Jadwal</span>
                <select
                  value={scheduleMode}
                  onChange={(event) => setScheduleMode(event.target.value as 'inherit' | 'custom')}
                >
                  <option value="inherit">Ikuti jadwal kamera</option>
                  <option value="custom">Jadwal khusus zona</option>
                </select>
              </label>
              {scheduleMode === 'custom' && (
                <ScheduleEditor value={schedule} onChange={setSchedule} />
              )}
              {create.error && <p className="form-error">{create.error.message}</p>}
              <Button disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
                Simpan zona
              </Button>
            </div>
          </Card>
          <Card>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Configured</span>
                <h2>Zona aktif</h2>
              </div>
              <span className="muted">{zones.data?.length ?? 0}</span>
            </div>
            <div className="zone-list">
              {(remove.error || update.error) && (
                <p className="form-error">
                  {(remove.error instanceof Error ? remove.error.message : undefined) ??
                    (update.error instanceof Error ? update.error.message : 'Operasi zona gagal')}
                </p>
              )}
              {zones.data?.map((zone) => (
                <div className="zone-list__item" key={zone._id}>
                  <span className={`zone-swatch zone-swatch--${zone.kind}`} />
                  <div>
                    <strong>{zone.name}</strong>
                    <small>
                      {zone.kind} ·{' '}
                      {zone.scheduleMode === 'inherit' ? 'jadwal kamera' : 'jadwal khusus'}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => update.mutate({ zone, input: { enabled: !zone.enabled } })}
                  >
                    <span className={`status-dot status-dot--${zone.enabled ? 'green' : 'gray'}`} />
                  </button>
                  <button className="icon-button danger-text" onClick={() => remove.mutate(zone)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!zones.data?.length && <p className="muted">Belum ada zona pada kamera ini.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
