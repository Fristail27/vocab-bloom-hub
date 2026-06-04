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
  AddMeaningResT,
  type AddMeaningTranslationReqT,
  AddMeaningTranslationResT,
  AddResT,
  AddShortTranslationResT,
  AddWordFormResT,
  CheckWordResT,
  DeleteMeaningResT,
  DeleteMeaningTranslationResT,
  DeleteResT,
  DeleteShortTranslationResT,
  EditMeaningResT,
  type EditMeaningTranslationReqT,
  EditMeaningTranslationResT,
  EditShortTranslationResT,
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
import { AddShortTranslationReqDTO } from './dto/AddShortTranslationReq.dto';
import { EditShortTranslationReqDTO } from './dto/EditShortTranslationReq.dto';
import { AddMeaningReqDTO } from './dto/AddMeaningReq.dto';
import { EditMeaningReqDTO } from './dto/EditMeaningReq.dto';

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

  @UseGuards(AdminGuard)
  @Post('short-translation')
  async addShortTranslation(@Body() body: AddShortTranslationReqDTO): Promise<AddShortTranslationResT> {
    return this.enService.addSingleShortTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Delete('short-translation/:id')
  async deleteShortTranslation(@Param('id') id: string): Promise<DeleteShortTranslationResT> {
    return this.enService.deleteShortTranslation(+id);
  }

  @UseGuards(AdminGuard)
  @Patch('short-translation')
  async editShortTranslation(@Body() body: EditShortTranslationReqDTO): Promise<EditShortTranslationResT> {
    return this.enService.editShortTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Post('meaning')
  async addMeaning(@Body() body: AddMeaningReqDTO): Promise<AddMeaningResT> {
    return this.enService.addSingleMeaning(body);
  }

  @UseGuards(AdminGuard)
  @Patch('meaning')
  async editMeaning(@Body() body: EditMeaningReqDTO): Promise<EditMeaningResT> {
    return this.enService.editMeaning(body);
  }

  @UseGuards(AdminGuard)
  @Delete('meaning/:id')
  async deleteMeaning(@Param('id') id: string): Promise<DeleteMeaningResT> {
    return this.enService.deleteMeaning(+id);
  }

  @UseGuards(AdminGuard)
  @Post('meaning-translation')
  async addMeaningTranslation(@Body() body: AddMeaningTranslationReqT): Promise<AddMeaningTranslationResT> {
    return this.enService.addSingleMeaningTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Patch('meaning-translation')
  async editMeaningTranslation(@Body() body: EditMeaningTranslationReqT): Promise<EditMeaningTranslationResT> {
    return this.enService.editMeaningTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Delete('meaning-translation/:id')
  async deleteMeaningTranslation(@Param('id') id: string): Promise<DeleteMeaningTranslationResT> {
    return this.enService.deleteMeaningTranslation(+id);
  }
}
