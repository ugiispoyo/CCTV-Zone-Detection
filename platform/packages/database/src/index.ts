import { Schema, Types } from 'mongoose';
import type {
  BoundingBox,
  CameraPreviewSettings,
  CameraRuntimeStatus,
  DetectionSchedule,
  Point,
  ScheduleMode,
  ZoneKind,
} from '@cctv/contracts';

export interface CameraRecord {
  name: string;
  description?: string;
  location?: string;
  rtspUrl: string;
  previewUrl?: string;
  enabled: boolean;
  timezone: string;
  schedule: DetectionSchedule;
  preview: CameraPreviewSettings;
  runtimeStatus: CameraRuntimeStatus;
  lastSeenAt?: Date;
  lastError?: string;
}

export interface ZoneRecord {
  cameraId: Types.ObjectId;
  name: string;
  description?: string;
  kind: ZoneKind;
  points: Point[];
  enabled: boolean;
  scheduleMode: ScheduleMode;
  schedule?: DetectionSchedule;
  direction?: 'both' | 'a-to-b' | 'b-to-a';
}

export interface TelegramRecipientRecord {
  name: string;
  chatId: string;
  enabled: boolean;
  cameraScope: 'all' | 'selected';
  cameraIds: Types.ObjectId[];
}

export interface EventMediaItem {
  objectKey: string;
  mimeType: string;
  size: number;
  checksum?: string;
}

export interface DetectionEventRecord {
  eventId: string;
  cameraId: Types.ObjectId;
  zoneId: Types.ObjectId;
  trackId: string;
  objectType: 'person' | 'car' | 'motorcycle' | 'head';
  occurredAt: Date;
  confidence: number;
  objectBox: BoundingBox;
  headBox?: BoundingBox;
  faceBox?: BoundingBox;
  trigger: 'line-crossed' | 'zone-entered';
  direction?: string;
  status: 'detected' | 'media-processing' | 'ready' | 'notified' | 'failed';
  media: Partial<Record<'face' | 'body' | 'frame' | 'clip', EventMediaItem>>;
  failureReason?: string;
}

export interface TelegramDeliveryRecord {
  eventId: string;
  recipientId: Types.ObjectId;
  chatId: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  sentAt?: Date;
  error?: string;
}

const timeWindowSchema = new Schema(
  { start: { type: String, required: true }, end: { type: String, required: true } },
  { _id: false },
);

const scheduleSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    days: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    windows: { type: [timeWindowSchema], default: [] },
  },
  { _id: false },
);

const pointSchema = new Schema(
  { x: { type: Number, min: 0, max: 1 }, y: { type: Number, min: 0, max: 1 } },
  { _id: false },
);

const boundingBoxSchema = new Schema(
  {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  { _id: false },
);

const mediaItemSchema = new Schema(
  { objectKey: String, mimeType: String, size: Number, checksum: String },
  { _id: false },
);

export const CameraSchema = new Schema<CameraRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    location: { type: String, trim: true, maxlength: 200 },
    rtspUrl: { type: String, required: true, trim: true },
    previewUrl: { type: String, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    timezone: { type: String, default: 'Asia/Jakarta' },
    schedule: { type: scheduleSchema, default: () => ({ enabled: false }) },
    preview: {
      type: new Schema(
        {
          showBoundingBoxes: { type: Boolean, default: true },
          inferenceFps: { type: Number, default: 2, min: 1, max: 10 },
          idleTimeoutSeconds: { type: Number, default: 60, min: 15, max: 900 },
          quality: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    runtimeStatus: { type: String, default: 'inactive', index: true },
    lastSeenAt: Date,
    lastError: String,
  },
  { timestamps: true, versionKey: false },
);

export const ZoneSchema = new Schema<ZoneRecord>(
  {
    cameraId: { type: Schema.Types.ObjectId, ref: 'Camera', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    kind: { type: String, enum: ['line', 'polygon'], required: true },
    points: { type: [pointSchema], required: true },
    enabled: { type: Boolean, default: true, index: true },
    scheduleMode: { type: String, enum: ['inherit', 'custom'], default: 'inherit' },
    schedule: scheduleSchema,
    direction: { type: String, enum: ['both', 'a-to-b', 'b-to-a'], default: 'both' },
  },
  { timestamps: true, versionKey: false },
);

ZoneSchema.index({ cameraId: 1, name: 1 }, { unique: true });

export const TelegramRecipientSchema = new Schema<TelegramRecipientRecord>(
  {
    name: { type: String, required: true, trim: true },
    chatId: { type: String, required: true, trim: true, unique: true },
    enabled: { type: Boolean, default: true, index: true },
    cameraScope: { type: String, enum: ['all', 'selected'], default: 'all' },
    cameraIds: [{ type: Schema.Types.ObjectId, ref: 'Camera' }],
  },
  { timestamps: true, versionKey: false },
);

export const DetectionEventSchema = new Schema<DetectionEventRecord>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    cameraId: { type: Schema.Types.ObjectId, ref: 'Camera', required: true, index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true, index: true },
    trackId: { type: String, required: true },
    objectType: {
      type: String,
      enum: ['person', 'car', 'motorcycle', 'head'],
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true, index: true },
    confidence: { type: Number, required: true },
    objectBox: { type: boundingBoxSchema, required: true },
    headBox: boundingBoxSchema,
    faceBox: boundingBoxSchema,
    trigger: { type: String, enum: ['line-crossed', 'zone-entered'], required: true },
    direction: String,
    status: { type: String, default: 'detected', index: true },
    media: {
      face: mediaItemSchema,
      body: mediaItemSchema,
      frame: mediaItemSchema,
      clip: mediaItemSchema,
    },
    failureReason: String,
  },
  { timestamps: true, versionKey: false },
);

DetectionEventSchema.index({ cameraId: 1, occurredAt: -1 });

export const TelegramDeliverySchema = new Schema<TelegramDeliveryRecord>(
  {
    eventId: { type: String, required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'TelegramRecipient', required: true },
    chatId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    sentAt: Date,
    error: String,
  },
  { timestamps: true, versionKey: false },
);

TelegramDeliverySchema.index({ eventId: 1, recipientId: 1 }, { unique: true });

export const MODEL = {
  camera: 'Camera',
  zone: 'Zone',
  recipient: 'TelegramRecipient',
  event: 'DetectionEvent',
  delivery: 'TelegramDelivery',
} as const;
