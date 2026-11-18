import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type R2Config = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export class R2Storage {
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(input: {
    objectKey: string;
    filePath: string;
    contentType: string;
    checksum?: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        Body: createReadStream(input.filePath),
        ContentType: input.contentType,
        Metadata: input.checksum ? { sha256: input.checksum } : undefined,
      }),
    );
  }

  async signedReadUrl(objectKey: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
      { expiresIn },
    );
  }
}

export class TelegramClient {
  constructor(private readonly token: string) {}

  async sendMediaGroup(input: {
    chatId: string;
    caption: string;
    photos: string[];
    video: string;
  }): Promise<void> {
    const media = [
      ...input.photos.map((url, index) => ({
        type: 'photo',
        media: url,
        caption: index === 0 ? input.caption : undefined,
        parse_mode: index === 0 ? 'HTML' : undefined,
      })),
      { type: 'video', media: input.video, supports_streaming: true },
    ];
    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMediaGroup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: input.chatId, media }),
    });
    if (!response.ok) throw new Error(`Telegram returned HTTP ${response.status}`);
  }
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadEnvironment(): void {
  const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
  const candidates = [
    resolve(invocationDirectory, '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const path of new Set(candidates)) {
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
