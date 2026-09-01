import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnShortTranslationService } from './enShortTranslation.service';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import {
  AddShortTranslationResT,
  DeleteShortTranslationResT,
  EditShortTranslationResT,
} from '../../../../../types';
import { AddShortTranslationReqDTO } from './dto/AddShortTranslationReq.dto';
import { EditShortTranslationReqDTO } from './dto/EditShortTranslationReq.dto';

@ApiTags('En_Words')
@Controller('/api/en/word/')
export class EnShortTranslationController {
  constructor(private readonly enShortTranslationService: EnShortTranslationService) {}

  @UseGuards(AdminGuard)
  @Post('short-translation')
  async addShortTranslation(@Body() body: AddShortTranslationReqDTO): Promise<AddShortTranslationResT> {
    return this.enShortTranslationService.addShortTranslation(body);
  }

  @UseGuards(AdminGuard)
  @Delete('short-translation/:id')
  async deleteShortTranslation(@Param('id', ParseIntPipe) id: number): Promise<DeleteShortTranslationResT> {
    return this.enShortTranslationService.deleteShortTranslation(id);
  }

  @UseGuards(AdminGuard)
  @Patch('short-translation')
  async editShortTranslation(@Body() body: EditShortTranslationReqDTO): Promise<EditShortTranslationResT> {
    return this.enShortTranslationService.editShortTranslation(body);
  }
}
