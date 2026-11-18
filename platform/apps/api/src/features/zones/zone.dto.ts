import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ScheduleDto } from '../cameras/camera.dto';

export class PointDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;
}

export class CreateZoneDto {
  @IsMongoId()
  cameraId!: string;

  @ApiProperty({ example: 'Area Kasir' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(['line', 'polygon'])
  kind!: 'line' | 'polygon';

  @ValidateNested({ each: true })
  @Type(() => PointDto)
  points!: PointDto[];

  @IsBoolean()
  enabled!: boolean;

  @IsIn(['inherit', 'custom'])
  scheduleMode!: 'inherit' | 'custom';

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;

  @IsOptional()
  @IsIn(['both', 'a-to-b', 'b-to-a'])
  direction?: 'both' | 'a-to-b' | 'b-to-a';
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
