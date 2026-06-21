import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnService } from './en.service';
import { AdminGuard } from '../AuthModule/guards/admin.guard';
import {
  AddResT,
  AddWordFormResT,
  CheckWordResT,
  DeleteResT,
  EditCommonInfoOfWordResT,
  EditPhrasalBaseResT,
  EditWordFormResT,
  EnEntryTypesE,
  EnPartOfSpeechE,
  type EnWordT,
  GetWordByIdResT,
  SearchResT,
} from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { AddWordFormReqDTO } from './dto/AddWordFormReq.dto';
import { EditWordFormReqDTO } from './dto/EditWordFormReq.dto';
import { EditCommonInfoOfWordReqDTO } from './dto/EditCommonInfoOfWordReq.dto';
import { EditPhrasalBaseReqDTO } from './dto/EditPhrasalBase.dto';

@ApiTags('En_Words')
@Controller('/api/en/')
export class EnController {
  constructor(private readonly enService: EnService) {}

  @UseGuards(AdminGuard)
  @Get('check-word/:word')
  async checkWord(
    @Param('word') word: string,
    @Query() query: { partOfSpeech: EnPartOfSpeechE; forPhrasal: string },
  ): Promise<CheckWordResT> {
    try {
      const { partOfSpeech, forPhrasal } = query;
      const id = await this.enService.checkWord(word, partOfSpeech, forPhrasal === 'true');
      return { hasWord: !!id, ...(id && { id }) };
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
  async search(@Body() body: SearchReqDTO): Promise<SearchResT> {
    try {
      return this.enService.search(body);
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async deleteWord(@Param('id') id: string): Promise<DeleteResT> {
    try {
      return this.enService.deleteWord(+id);
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }

  @UseGuards(AdminGuard)
  @Patch('common-info/:id')
  async editWord(
    @Param('id') id: string,
    @Body() body: EditCommonInfoOfWordReqDTO,
  ): Promise<EditCommonInfoOfWordResT> {
    return this.enService.editWord(+id, body);
  }

  @UseGuards(AdminGuard)
  @Patch('phrasal-base')
  async editPhrasalBase(@Body() body: EditPhrasalBaseReqDTO): Promise<EditPhrasalBaseResT> {
    return this.enService.editPhrasalBase(body);
  }

  @UseGuards(AdminGuard)
  @Get(':id')
  async getWordById(@Param('id') id: string): Promise<GetWordByIdResT> {
    return this.enService.getWordById(+id);
  }

  @UseGuards(AdminGuard)
  @Post('word-form')
  async addWordForm(@Body() body: AddWordFormReqDTO): Promise<AddWordFormResT> {
    return this.enService.addWordForm(body);
  }

  @UseGuards(AdminGuard)
  @Patch('word-form')
  async editWordForm(@Body() body: EditWordFormReqDTO): Promise<EditWordFormResT> {
    return this.enService.editWordForm(body);
  }
}
