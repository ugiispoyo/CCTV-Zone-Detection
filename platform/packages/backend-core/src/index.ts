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

  async download(objectKey: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
    );
    if (!response.Body) throw new Error(`R2 object ${objectKey} has no body`);
    return response.Body.transformToByteArray();
  }
}

type TelegramUpload = {
  data: Uint8Array;
  filename: string;
  contentType: string;
};

export class TelegramClient {
  constructor(private readonly token: string) {}

  async sendMessage(input: { chatId: string; text: string; timeoutMs?: number }): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: input.chatId, text: input.text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 2500),
    });
    if (!response.ok) await this.throwTelegramError(response);
  }

  async sendMediaGroup(input: {
    chatId: string;
    caption: string;
    photos: TelegramUpload[];
    video: TelegramUpload;
  }): Promise<void> {
    const media = [
      ...input.photos.map((_file, index) => ({
        type: 'photo',
        media: `attach://photo${index}`,
        caption: index === 0 ? input.caption : undefined,
        parse_mode: index === 0 ? 'HTML' : undefined,
      })),
      { type: 'video', media: 'attach://video', supports_streaming: true },
    ];
    const form = new FormData();
    form.set('chat_id', input.chatId);
    form.set('media', JSON.stringify(media));
    input.photos.forEach((file, index) => {
      form.set(
        `photo${index}`,
        new Blob([Buffer.from(file.data)], { type: file.contentType }),
        file.filename,
      );
    });
    form.set(
      'video',
      new Blob([Buffer.from(input.video.data)], { type: input.video.contentType }),
      input.video.filename,
    );
    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMediaGroup`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) await this.throwTelegramError(response);
  }

  private async throwTelegramError(response: Response): Promise<never> {
    const payload = (await response.json().catch(() => null)) as {
      description?: string;
    } | null;
    throw new Error(
      `Telegram returned HTTP ${response.status}: ${payload?.description ?? 'unknown error'}`,
    );
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
