import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnImportDictionaryService } from './enImportDictionary.service';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { ImportDictionaryReq } from './dto/ImportDictionaryReq.dto';
import type { Response } from 'express';

@ApiTags('En_Words')
@Controller('/api/en/dictionary/')
export class EnImportDictionaryController {
  constructor(private readonly enImportDictionaryService: EnImportDictionaryService) {}

  @UseGuards(AdminGuard)
  @Post('import')
  async importDictionary(@Body() body: ImportDictionaryReq, @Res() res: Response): Promise<void> {
    return this.enImportDictionaryService.importDictionary(body, res);
  }

  @UseGuards(AdminGuard)
  @Get('export')
  async exportDictionary(@Res() res: Response): Promise<void> {
    return this.enImportDictionaryService.exportDictionary(res);
  }
}
