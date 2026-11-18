import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CameraHeartbeatDto } from '../cameras/camera.dto';

class BoundingBoxDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  width!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  height!: number;
}

export class DetectionEventDto {
  @IsIn(['2.0'])
  schemaVersion!: '2.0';

  @IsUUID()
  eventId!: string;

  @IsMongoId()
  cameraId!: string;

  @IsMongoId()
  zoneId!: string;

  @IsString()
  trackId!: string;

  @IsIn(['person', 'car', 'motorcycle', 'head'])
  objectType!: 'person' | 'car' | 'motorcycle' | 'head';

  @IsDateString()
  occurredAt!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @ValidateNested()
  @Type(() => BoundingBoxDto)
  objectBox!: BoundingBoxDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  headBox?: BoundingBoxDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoundingBoxDto)
  faceBox?: BoundingBoxDto;

  @IsIn(['line-crossed', 'zone-entered'])
  trigger!: 'line-crossed' | 'zone-entered';

  @IsOptional()
  @IsString()
  direction?: string;
}

export { CameraHeartbeatDto };
