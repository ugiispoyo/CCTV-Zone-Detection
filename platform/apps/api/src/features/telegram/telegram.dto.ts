import { IsArray, IsBoolean, IsIn, IsMongoId, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateRecipientDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  chatId!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsIn(['all', 'selected'])
  cameraScope!: 'all' | 'selected';

  @IsArray()
  @IsMongoId({ each: true })
  cameraIds!: string[];
}

export class UpdateRecipientDto extends PartialType(CreateRecipientDto) {}
