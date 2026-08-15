import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnMeaningTranslationService } from './enMeaningTranslation.service';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import {
  AddMeaningTranslationResT,
  DeleteMeaningTranslationResT,
  EditMeaningTranslationResT,
} from '../../../../../types';
import { AddMeaningTranslationReqDTO } from './dto/AddMeaningTranslationReq.dto';
import { EditMeaningTranslationReqDTO } from './dto/EditMeaningTranslationReq.dto';

@ApiTags('En_Words')
@Controller('/api/en/word/')
export class EnMeaningTranslationController {
  constructor(private readonly enMeaningTranslationService: EnMeaningTranslationService) {}

  @UseGuards(AdminGuard)
  @Post('meaning-translation')
  async addMeaningTranslation(@Body() body: AddMeaningTranslationReqDTO): Promise<AddMeaningTranslationResT> {
    return this.enMeaningTranslationService.addMeaningTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Patch('meaning-translation')
  async editMeaningTranslation(
    @Body() body: EditMeaningTranslationReqDTO,
  ): Promise<EditMeaningTranslationResT> {
    return this.enMeaningTranslationService.editMeaningTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Delete('meaning-translation/:id')
  async deleteMeaningTranslation(@Param('id') id: string): Promise<DeleteMeaningTranslationResT> {
    return this.enMeaningTranslationService.deleteMeaningTranslation(+id);
  }
}
