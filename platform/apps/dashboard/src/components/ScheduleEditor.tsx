import type { Schedule } from '../lib/types';
import { Button } from './ui';

const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function ScheduleEditor({
  value,
  onChange,
}: {
  value: Schedule;
  onChange: (value: Schedule) => void;
}) {
  const setDay = (day: number) => {
    const next = value.days.includes(day)
      ? value.days.filter((item) => item !== day)
      : [...value.days, day];
    onChange({ ...value, days: next.sort() });
  };
  const setWindow = (index: number, key: 'start' | 'end', nextValue: string) => {
    const windows = value.windows.map((window, itemIndex) =>
      itemIndex === index ? { ...window, [key]: nextValue } : window,
    );
    onChange({ ...value, windows });
  };

  return (
    <div className="schedule-editor">
      <label className="toggle-row">
        <span>
          <strong>Gunakan jadwal deteksi</strong>
          <small>Jika mati, deteksi tersedia 24 jam.</small>
        </span>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
      </label>
      {value.enabled && (
        <>
          <div className="day-picker">
            {days.map((day, index) => (
              <button
                type="button"
                key={day}
                className={value.days.includes(index) ? 'selected' : ''}
                onClick={() => setDay(index)}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="time-windows">
            {value.windows.map((window, index) => (
              <div className="time-window" key={`${index}-${window.start}`}>
                <input
                  type="time"
                  value={window.start}
                  onChange={(event) => setWindow(index, 'start', event.target.value)}
                />
                <span>hingga</span>
                <input
                  type="time"
                  value={window.end}
                  onChange={(event) => setWindow(index, 'end', event.target.value)}
                />
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    onChange({ ...value, windows: value.windows.filter((_, i) => i !== index) })
                  }
                >
                  Hapus
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  windows: [...value.windows, { start: '08:00', end: '17:00' }],
                })
              }
            >
              + Rentang waktu
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
