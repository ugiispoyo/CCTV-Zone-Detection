import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateRecipientDto, UpdateRecipientDto } from './telegram.dto';
import { TelegramService } from './telegram.service';

@ApiTags('telegram')
@Controller('telegram/recipients')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Get()
  list() {
    return this.telegram.list();
  }

  @Post()
  create(@Body() input: CreateRecipientDto) {
    return this.telegram.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateRecipientDto) {
    return this.telegram.update(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.telegram.remove(id);
  }
}
