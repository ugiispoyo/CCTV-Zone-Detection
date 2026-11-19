import { BellRing, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

type DetectionToast = {
  eventId: string;
  objectType: 'person' | 'car' | 'motorcycle' | 'head';
  confidence: number;
  trigger: 'line-crossed' | 'zone-entered';
  occurredAt: string;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';
const objectLabels: Record<DetectionToast['objectType'], string> = {
  person: 'Orang',
  car: 'Mobil',
  motorcycle: 'Motor',
  head: 'Kepala',
};

export function DetectionToasts() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<DetectionToast[]>([]);
  const timers = useRef(new Set<number>());

  const dismiss = (eventId: string) => {
    setToasts((current) => current.filter((toast) => toast.eventId !== eventId));
  };

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/realtime`, { transports: ['websocket', 'polling'] });
    const onDetection = (event: DetectionToast) => {
      if (!event?.eventId) return;
      setToasts((current) => [event, ...current.filter((item) => item.eventId !== event.eventId)].slice(0, 5));
      const timer = window.setTimeout(() => {
        dismiss(event.eventId);
        timers.current.delete(timer);
      }, 10_000);
      timers.current.add(timer);
    };
    socket.on('detection.event', onDetection);
    return () => {
      socket.off('detection.event', onDetection);
      socket.disconnect();
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current.clear();
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <aside className="toast-stack" aria-live="assertive" aria-label="Notifikasi deteksi">
      {toasts.map((toast) => (
        <article
          className="detection-toast"
          key={toast.eventId}
          onClick={() => navigate(`/events?eventId=${encodeURIComponent(toast.eventId)}`)}
        >
          <span className="detection-toast__icon">
            <BellRing size={19} />
          </span>
          <div className="detection-toast__body">
            <strong>{objectLabels[toast.objectType]} terdeteksi</strong>
            <span>
              {toast.trigger === 'line-crossed' ? 'Melewati garis' : 'Memasuki zona'} ·{' '}
              {(toast.confidence * 100).toFixed(0)}%
            </span>
            <small>{new Date(toast.occurredAt).toLocaleTimeString('id-ID')}</small>
          </div>
          <button
            className="detection-toast__close"
            type="button"
            aria-label="Tutup notifikasi"
            onClick={(event) => {
              event.stopPropagation();
              dismiss(toast.eventId);
            }}
          >
            <X size={16} />
          </button>
          <span className="detection-toast__timer" />
        </article>
      ))}
    </aside>
  );
}
