import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnService } from './en.service';
import { AdminGuard } from '../AuthModule/guards/admin.guard';
import {
  AddResT,
  CheckWordResT,
  DeleteResT,
  EnEntryTypesE,
  EnPartOfSpeechE,
  type EnWordT,
} from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { SearchReqDTO } from './dto/SearchReq.dto';

@ApiTags('En_Words')
@Controller('/api/en/')
export class EnController {
  constructor(private readonly enService: EnService) {}

  @UseGuards(AdminGuard)
  @Get('check-word/:word')
  async checkWord(
    @Param('word') word: string,
    @Query() query: { partOfSpeech: EnPartOfSpeechE },
  ): Promise<CheckWordResT> {
    try {
      const { partOfSpeech } = query;
      return { hasWord: await this.enService.checkWord(word, partOfSpeech) };
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }

  @UseGuards(AdminGuard)
  @Post('add/:entryType')
  async add(@Param('entryType') entryType: EnEntryTypesE, @Body() body: EnWordT): Promise<AddResT> {
    return this.enService.addWord(body);
  }

  @Post('search')
  async search(@Body() body: SearchReqDTO): Promise<EnWordT[]> {
    try {
      return this.enService.search(body);
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }

  @Delete(':id')
  async deleteWord(@Param('id') id: string): Promise<DeleteResT> {
    try {
      return this.enService.deleteWord(+id);
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }
}
