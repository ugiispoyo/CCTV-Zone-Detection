import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class TimeWindowDto {
  @ApiProperty({ example: '14:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end!: string;
}

export class ScheduleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days!: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeWindowDto)
  windows!: TimeWindowDto[];
}

export class PreviewSettingsDto {
  @IsBoolean()
  showBoundingBoxes!: boolean;

  @IsInt()
  @Min(1)
  @Max(10)
  inferenceFps!: number;

  @IsInt()
  @Min(15)
  @Max(900)
  idleTimeoutSeconds!: number;

  @IsIn(['low', 'medium', 'high'])
  quality!: 'low' | 'medium' | 'high';
}

export class CreateCameraDto {
  @ApiProperty({ example: 'Pintu Utama' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Lantai 1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiProperty({ example: 'rtsp://user:password@192.168.1.10:554/stream' })
  @IsString()
  @Matches(/^rtsps?:\/\//i)
  rtspUrl!: string;

  @ApiPropertyOptional({ description: 'WebRTC/HLS URL used by the browser' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  previewUrl?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  timezone!: string;

  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule!: ScheduleDto;

  @ValidateNested()
  @Type(() => PreviewSettingsDto)
  preview!: PreviewSettingsDto;
}

export class UpdateCameraDto extends PartialType(CreateCameraDto) {}

export class CameraEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class CameraHeartbeatDto {
  @IsIn(['connecting', 'online', 'reconnecting', 'error', 'scheduled-off', 'inactive'])
  status!: string;

  @IsOptional()
  @IsString()
  error?: string;
}
