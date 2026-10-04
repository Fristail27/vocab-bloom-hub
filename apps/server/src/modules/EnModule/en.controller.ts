import { UpdateOriginsReqDTO } from './dto/UpdateOriginsReq.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
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
  GetWordByIdResT,
  ResetEntryUserModifiedResT,
} from '../../../types';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { AddWordReqDTO } from './dto/AddWordReq.dto';
import { CheckWordQueryDTO } from './dto/CheckWordQuery.dto';
import { AddWordFormReqDTO } from './dto/AddWordFormReq.dto';
import { EditWordFormReqDTO } from './dto/EditWordFormReq.dto';
import { EditCommonInfoOfWordReqDTO } from './dto/EditCommonInfoOfWordReq.dto';
import { EditPhrasalBaseReqDTO } from './dto/EditPhrasalBase.dto';
import { ApiDatasetQuery } from '../DatasetsModule/api-dataset-query';

@ApiTags('En_Words')
// the dataset the request works on (issue #540)
@ApiDatasetQuery()
@Controller('/api/en/')
export class EnController {
  constructor(private readonly enService: EnService) {}

  @UseGuards(AdminGuard)
  @Get('check-word/:word')
  async checkWord(@Param('word') word: string, @Query() query: CheckWordQueryDTO): Promise<CheckWordResT> {
    try {
      const { partOfSpeech, forPhrasal } = query;
      const id = await this.enService.checkWord(word, partOfSpeech, forPhrasal === 'true');
      return { hasWord: !!id, ...(id && { id }) };
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }

  @UseGuards(AdminGuard)
  @Get('copy-preview/:source/:id')
  async previewCopy(@Param('source') source: string, @Param('id', ParseIntPipe) id: number) {
    return this.enService.previewCopy(source, id);
  }

  @UseGuards(AdminGuard)
  @Post('add/:entryType')
  async add(@Param('entryType') entryType: EnEntryTypesE, @Body() body: AddWordReqDTO): Promise<AddResT> {
    return this.enService.addWord(body);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/origins')
  async updateOrigins(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateOriginsReqDTO) {
    return this.enService.updateOrigins(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async deleteWord(@Param('id', ParseIntPipe) id: number): Promise<DeleteResT> {
    return this.enService.deleteWord(id);
  }

  @UseGuards(AdminGuard)
  @Patch('common-info/:id')
  async editWord(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EditCommonInfoOfWordReqDTO,
  ): Promise<EditCommonInfoOfWordResT> {
    return this.enService.editWord(id, body);
  }

  @UseGuards(AdminGuard)
  @Patch('phrasal-base')
  async editPhrasalBase(@Body() body: EditPhrasalBaseReqDTO): Promise<EditPhrasalBaseResT> {
    return this.enService.editPhrasalBase(body);
  }

  @UseGuards(AdminGuard)
  @Get(':id')
  async getWordById(@Param('id', ParseIntPipe) id: number): Promise<GetWordByIdResT> {
    return this.enService.getWordById(id);
  }

  // Clears the user-modified flag of an entry (issue #328): the next
  // dictionary update replaces the entry with the dataset content again
  @UseGuards(AdminGuard)
  @Patch('reset-user-modified/:word')
  async resetEntryUserModified(@Param('word') word: string): Promise<ResetEntryUserModifiedResT> {
    return this.enService.resetEntryUserModified(word);
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
