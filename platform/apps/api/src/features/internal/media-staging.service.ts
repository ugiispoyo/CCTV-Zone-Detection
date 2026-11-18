import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaKind, MediaUploadMessage, StagedMedia } from '@cctv/contracts';
import { MultipartFile } from '@fastify/multipart';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const acceptedFields = new Set<MediaKind>(['face', 'body', 'frame', 'clip']);
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'video/mp4']);

@Injectable()
export class MediaStagingService {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = resolve(config.get<string>('MEDIA_STAGING_DIR') ?? './staging-media');
  }

  async save(eventId: string, parts: AsyncIterableIterator<unknown>): Promise<MediaUploadMessage> {
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new BadRequestException('Invalid event ID');
    const eventDir = join(this.baseDir, eventId);
    await mkdir(eventDir, { recursive: true });
    const files: Partial<Record<MediaKind, StagedMedia>> = {};

    for await (const rawPart of parts) {
      const part = rawPart as MultipartFile;
      if (part.type !== 'file') continue;
      const kind = part.fieldname as MediaKind;
      if (!acceptedFields.has(kind))
        throw new BadRequestException(`Unexpected media field: ${kind}`);
      if (!acceptedMimeTypes.has(part.mimetype)) {
        throw new BadRequestException(`Unsupported media type: ${part.mimetype}`);
      }
      const suffix = extname(part.filename) || (part.mimetype === 'video/mp4' ? '.mp4' : '.jpg');
      const filePath = join(eventDir, `${kind}${suffix}`);
      const hash = createHash('sha256');
      part.file.on('data', (chunk: Buffer) => hash.update(chunk));
      await pipeline(part.file, createWriteStream(filePath, { flags: 'wx' }));
      const fileStat = await stat(filePath);
      files[kind] = {
        path: filePath,
        mimeType: part.mimetype,
        size: fileStat.size,
        checksum: hash.digest('hex'),
      };
    }

    if (!files.body || !files.frame || !files.clip) {
      throw new BadRequestException('body, frame, and clip files are required');
    }
    return { schemaVersion: '1.0', eventId, files };
  }
}
