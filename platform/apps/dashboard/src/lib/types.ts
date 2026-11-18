export type TimeWindow = { start: string; end: string };
export type Schedule = { enabled: boolean; days: number[]; windows: TimeWindow[] };
export type Point = { x: number; y: number };

export type Camera = {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  location?: string;
  rtspUrlMasked: string;
  previewUrl?: string;
  enabled: boolean;
  timezone: string;
  schedule: Schedule;
  preview: {
    showBoundingBoxes: boolean;
    inferenceFps: number;
    idleTimeoutSeconds: number;
    quality: 'low' | 'medium' | 'high';
  };
  runtimeStatus: string;
  lastSeenAt?: string;
  lastError?: string;
};

export type Zone = {
  _id: string;
  cameraId: string;
  name: string;
  description?: string;
  kind: 'line' | 'polygon';
  points: Point[];
  enabled: boolean;
  scheduleMode: 'inherit' | 'custom';
  schedule?: Schedule;
  direction?: 'both' | 'a-to-b' | 'b-to-a';
};

export type DetectionEvent = {
  _id: string;
  eventId: string;
  cameraId: Camera | string | null;
  zoneId: Zone | string | null;
  occurredAt: string;
  objectType: 'person' | 'car' | 'motorcycle' | 'head';
  confidence: number;
  trigger: string;
  status: string;
  media?: Record<string, { objectKey: string; mimeType: string }>;
  mediaUrls?: Record<string, string>;
};

export type Recipient = {
  _id: string;
  name: string;
  chatId: string;
  enabled: boolean;
  cameraScope: 'all' | 'selected';
  cameraIds: Array<Camera | string>;
};
