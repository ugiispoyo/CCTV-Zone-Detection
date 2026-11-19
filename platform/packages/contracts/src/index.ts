export type Point = { x: number; y: number };
export type BoundingBox = { x: number; y: number; width: number; height: number };

export type TimeWindow = { start: string; end: string };
export type DetectionSchedule = {
  enabled: boolean;
  days: number[];
  windows: TimeWindow[];
};

export type CameraPreviewSettings = {
  showBoundingBoxes: boolean;
  inferenceFps: number;
  idleTimeoutSeconds: number;
  quality: 'low' | 'medium' | 'high';
};

export type CameraRuntimeStatus =
  'inactive' | 'scheduled-off' | 'connecting' | 'online' | 'reconnecting' | 'error';

export type ZoneKind = 'line' | 'polygon';
export type ScheduleMode = 'inherit' | 'custom';
export type DetectedObjectType = 'person' | 'car' | 'motorcycle' | 'head';

export interface DetectionEventMessage {
  schemaVersion: '2.0';
  eventId: string;
  cameraId: string;
  zoneId: string;
  trackId: string;
  objectType: DetectedObjectType;
  occurredAt: string;
  confidence: number;
  objectBox: BoundingBox;
  headBox?: BoundingBox;
  faceBox?: BoundingBox;
  trigger: 'line-crossed' | 'zone-entered';
  direction?: string;
}

export interface MediaUploadMessage {
  schemaVersion: '1.0';
  eventId: string;
  files: Partial<Record<MediaKind, StagedMedia>>;
}

export type MediaKind = 'face' | 'body' | 'frame' | 'clip';
export type StagedMedia = {
  path: string;
  mimeType: string;
  size: number;
  checksum: string;
};

export const EXCHANGE = {
  detections: 'cctv.detections',
  media: 'cctv.media',
  notifications: 'cctv.notifications',
  configuration: 'cctv.configuration',
} as const;

export const ROUTING_KEY = {
  detectionCreated: 'detection.created.v2',
  mediaUploadRequested: 'media.upload.requested.v1',
  mediaReady: 'media.ready.v1',
  cameraConfigurationChanged: 'camera.configuration.changed.v1',
} as const;

export const QUEUE = {
  eventWorker: 'platform.event-worker.v2',
  realtimeApi: 'platform.api-realtime.v2',
  mediaWorker: 'platform.media-worker.v1',
  telegramFast: 'platform.telegram-fast.v1',
  telegramLocalMedia: 'platform.telegram-local-media.v1',
  telegramWorker: 'platform.telegram-worker.v1',
} as const;
