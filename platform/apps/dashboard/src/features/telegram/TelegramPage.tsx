import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Plus, Send, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Spinner } from '../../components/ui';
import { api, json } from '../../lib/api';
import type { Camera, Recipient } from '../../lib/types';

type RecipientInput = Omit<Recipient, '_id' | 'cameraIds'> & { cameraIds: string[] };

function RecipientForm({
  cameras,
  onClose,
  onSave,
  busy,
  error,
}: {
  cameras: Camera[];
  onClose: () => void;
  onSave: (input: RecipientInput) => void;
  busy: boolean;
  error?: string;
}) {
  const [input, setInput] = useState<RecipientInput>({
    name: '',
    chatId: '',
    enabled: true,
    cameraScope: 'all',
    cameraIds: [],
  });
  const toggleCamera = (id: string) =>
    setInput((current) => ({
      ...current,
      cameraIds: current.cameraIds.includes(id)
        ? current.cameraIds.filter((item) => item !== id)
        : [...current.cameraIds, id],
    }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(input);
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>Nama penerima</span>
          <input
            required
            value={input.name}
            onChange={(event) => setInput({ ...input, name: event.target.value })}
            placeholder="Tim keamanan"
          />
        </label>
        <label className="field">
          <span>Telegram Chat ID</span>
          <input
            required
            value={input.chatId}
            onChange={(event) => setInput({ ...input, chatId: event.target.value })}
            placeholder="123456789"
          />
        </label>
      </div>
      <label className="field">
        <span>Cakupan kamera</span>
        <select
          value={input.cameraScope}
          onChange={(event) =>
            setInput({ ...input, cameraScope: event.target.value as 'all' | 'selected' })
          }
        >
          <option value="all">Semua kamera</option>
          <option value="selected">Kamera tertentu</option>
        </select>
      </label>
      {input.cameraScope === 'selected' && (
        <div className="camera-checklist">
          {cameras.map((camera) => (
            <label key={camera._id}>
              <input
                type="checkbox"
                checked={input.cameraIds.includes(camera._id)}
                onChange={() => toggleCamera(camera._id)}
              />
              <span>
                {camera.name}
                <small>{camera.location || 'Tanpa lokasi'}</small>
              </span>
            </label>
          ))}
        </div>
      )}
      <label className="toggle-row">
        <span>
          <strong>Penerima aktif</strong>
          <small>Hanya ID aktif yang menerima notifikasi.</small>
        </span>
        <input
          type="checkbox"
          checked={input.enabled}
          onChange={(event) => setInput({ ...input, enabled: event.target.checked })}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Batal
        </Button>
        <Button disabled={busy}>Simpan penerima</Button>
      </div>
    </form>
  );
}

export function TelegramPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const recipients = useQuery({
    queryKey: ['recipients'],
    queryFn: () => api<Recipient[]>('/telegram/recipients'),
  });
  const cameras = useQuery({ queryKey: ['cameras'], queryFn: () => api<Camera[]>('/cameras') });
  const create = useMutation({
    mutationFn: (input: RecipientInput) => api('/telegram/recipients', json('POST', input)),
    onSuccess: () => {
      setCreating(false);
      void queryClient.invalidateQueries({ queryKey: ['recipients'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (recipient: Recipient) =>
      api(`/telegram/recipients/${recipient._id}`, json('PATCH', { enabled: !recipient.enabled })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['recipients'] }),
  });
  const remove = useMutation({
    mutationFn: (recipient: Recipient) =>
      api(`/telegram/recipients/${recipient._id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['recipients'] }),
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Notification routing"
        title="Penerima Telegram"
        description="Bot hanya mengirimkan media kepada Telegram ID yang didaftarkan dari halaman ini."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={17} /> Tambah penerima
          </Button>
        }
      />
      {recipients.isLoading ? (
        <Spinner />
      ) : !recipients.data?.length ? (
        <EmptyState
          icon={<BellRing />}
          title="Belum ada penerima"
          description="Daftarkan Telegram Chat ID dan pilih cakupan kameranya."
        />
      ) : (
        <div className="recipient-list">
          {recipients.data.map((recipient) => (
            <Card className="recipient-card" key={recipient._id}>
              <span className="recipient-card__icon">
                <Send size={20} />
              </span>
              <div>
                <strong>{recipient.name}</strong>
                <small>Chat ID · {recipient.chatId}</small>
              </div>
              <div className="recipient-card__scope">
                <span>
                  {recipient.cameraScope === 'all'
                    ? 'Semua kamera'
                    : `${recipient.cameraIds.length} kamera dipilih`}
                </span>
                <Badge tone={recipient.enabled ? 'success' : 'neutral'}>
                  {recipient.enabled ? 'aktif' : 'nonaktif'}
                </Badge>
              </div>
              <Button variant="ghost" onClick={() => toggle.mutate(recipient)}>
                {recipient.enabled ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
              <Button
                variant="ghost"
                className="danger-text"
                onClick={() => remove.mutate(recipient)}
              >
                <Trash2 size={17} />
              </Button>
            </Card>
          ))}
        </div>
      )}
      {creating && (
        <Modal
          title="Tambah penerima Telegram"
          subtitle="Pastikan bot sudah dapat mengirim pesan ke Chat ID tujuan."
          onClose={() => setCreating(false)}
        >
          <RecipientForm
            cameras={cameras.data ?? []}
            onClose={() => setCreating(false)}
            onSave={(input) => create.mutate(input)}
            busy={create.isPending}
            error={create.error?.message}
          />
        </Modal>
      )}
    </div>
  );
}
