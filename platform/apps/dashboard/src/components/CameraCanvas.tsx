import type { Camera, Point, Zone } from '../lib/types';

export function CameraCanvas({
  camera,
  zones = [],
  draft = [],
  onPoint,
}: {
  camera: Camera;
  zones?: Zone[];
  draft?: Point[];
  onPoint?: (point: Point) => void;
}) {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onPoint) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onPoint({
      x: Number(((event.clientX - bounds.left) / bounds.width).toFixed(4)),
      y: Number(((event.clientY - bounds.top) / bounds.height).toFixed(4)),
    });
  };

  return (
    <div className="camera-canvas" onClick={handleClick}>
      {camera.previewUrl ? (
        <iframe
          title={`Preview ${camera.name}`}
          src={camera.previewUrl}
          allow="autoplay; fullscreen"
        />
      ) : (
        <div className="camera-placeholder">
          <span className="camera-placeholder__glow" />
          <strong>{camera.name}</strong>
          <small>Preview stream belum tersedia</small>
        </div>
      )}
      <svg viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-label="Overlay zona">
        {zones.map((zone) => {
          const points = zone.points
            .map((point) => `${point.x * 1000},${point.y * 562.5}`)
            .join(' ');
          return zone.kind === 'line' ? (
            <polyline key={zone._id} points={points} className="zone-line" />
          ) : (
            <polygon key={zone._id} points={points} className="zone-polygon" />
          );
        })}
        {draft.length > 0 && (
          <polyline
            points={draft.map((point) => `${point.x * 1000},${point.y * 562.5}`).join(' ')}
            className="zone-draft"
          />
        )}
        {draft.map((point, index) => (
          <circle
            key={index}
            cx={point.x * 1000}
            cy={point.y * 562.5}
            r="7"
            className="zone-point"
          />
        ))}
      </svg>
      <span className="live-pill">
        <i /> LIVE
      </span>
    </div>
  );
}
