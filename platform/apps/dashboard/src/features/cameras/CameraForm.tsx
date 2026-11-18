import { useState, type FormEvent } from 'react';
import { ScheduleEditor } from '../../components/ScheduleEditor';
import { Button } from '../../components/ui';
import type { Camera, Schedule } from '../../lib/types';

const defaultSchedule: Schedule = {
  enabled: false,
  days: [0, 1, 2, 3, 4, 5, 6],
  windows: [{ start: '08:00', end: '17:00' }],
};

export type CameraInput = {
  name: string;
  description?: string;
  location?: string;
  rtspUrl?: string;
  previewUrl?: string;
  enabled: boolean;
  timezone: string;
  schedule: Schedule;
  preview: Camera['preview'];
};

export function CameraForm({
  camera,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  camera?: Camera;
  busy: boolean;
  error?: string;
  onSubmit: (input: CameraInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<CameraInput>({
    name: camera?.name ?? '',
    description: camera?.description ?? '',
    location: camera?.location ?? '',
    rtspUrl: '',
    previewUrl: camera?.previewUrl ?? '',
    enabled: camera?.enabled ?? true,
    timezone: camera?.timezone ?? 'Asia/Jakarta',
    schedule: camera?.schedule ?? defaultSchedule,
    preview: camera?.preview ?? {
      showBoundingBoxes: true,
      inferenceFps: 2,
      idleTimeoutSeconds: 60,
      quality: 'medium',
    },
  });
  const set = <K extends keyof CameraInput>(key: K, value: CameraInput[K]) =>
    setInput((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(input);
  };

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>Nama kamera</span>
          <input
            required
            value={input.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Pintu utama"
          />
        </label>
        <label className="field">
          <span>Lokasi</span>
          <input
            value={input.location}
            onChange={(event) => set('location', event.target.value)}
            placeholder="Lantai 1"
          />
        </label>
      </div>
      <label className="field">
        <span>RTSP URL {camera && <small>— kosongkan jika tidak diubah</small>}</span>
        <input
          required={!camera}
          type="password"
          value={input.rtspUrl}
          onChange={(event) => set('rtspUrl', event.target.value)}
          placeholder="rtsp://user:password@host:554/stream"
        />
      </label>
      <label className="field">
        <span>
          Preview URL <small>— WebRTC/HLS gateway</small>
        </span>
        <input
          value={input.previewUrl}
          onChange={(event) => set('previewUrl', event.target.value)}
          placeholder="http://localhost:8889/camera-1/"
        />
      </label>
      <label className="field">
        <span>Deskripsi</span>
        <textarea
          rows={2}
          value={input.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="Catatan sudut pandang atau area kamera"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Zona waktu</span>
          <select value={input.timezone} onChange={(event) => set('timezone', event.target.value)}>
            <option>Asia/Jakarta</option>
            <option>Asia/Makassar</option>
            <option>Asia/Jayapura</option>
            <option>UTC</option>
          </select>
        </label>
        <label className="field">
          <span>Kualitas preview</span>
          <select
            value={input.preview.quality}
            onChange={(event) =>
              set('preview', {
                ...input.preview,
                quality: event.target.value as Camera['preview']['quality'],
              })
            }
          >
            <option value="low">Rendah</option>
            <option value="medium">Sedang</option>
            <option value="high">Tinggi</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Preview inference FPS</span>
          <input
            type="number"
            min={1}
            max={10}
            value={input.preview.inferenceFps}
            onChange={(event) =>
              set('preview', { ...input.preview, inferenceFps: Number(event.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>Idle timeout (detik)</span>
          <input
            type="number"
            min={15}
            max={900}
            value={input.preview.idleTimeoutSeconds}
            onChange={(event) =>
              set('preview', { ...input.preview, idleTimeoutSeconds: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <label className="toggle-row">
        <span>
          <strong>Bounding box saat live view</strong>
          <small>Inference ringan berjalan hanya ketika preview dilihat.</small>
        </span>
        <input
          type="checkbox"
          checked={input.preview.showBoundingBoxes}
          onChange={(event) =>
            set('preview', { ...input.preview, showBoundingBoxes: event.target.checked })
          }
        />
      </label>
      <label className="toggle-row">
        <span>
          <strong>Kamera aktif</strong>
          <small>CV hanya memproses kamera yang aktif.</small>
        </span>
        <input
          type="checkbox"
          checked={input.enabled}
          onChange={(event) => set('enabled', event.target.checked)}
        />
      </label>
      <ScheduleEditor value={input.schedule} onChange={(schedule) => set('schedule', schedule)} />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Batal
        </Button>
        <Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kamera'}</Button>
      </div>
    </form>
  );
}
