import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnMeaningService } from './enMeaning.service';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { AddMeaningResT, DeleteMeaningResT, EditMeaningResT } from '../../../../../types';
import { AddMeaningReqDTO } from './dto/AddMeaningReq.dto';
import { EditMeaningReqDTO } from './dto/EditMeaningReq.dto';

@ApiTags('En_Words')
@Controller('/api/en/word/')
export class EnMeaningController {
  constructor(private readonly enMeaningService: EnMeaningService) {}

  @UseGuards(AdminGuard)
  @Post('meaning')
  async addMeaning(@Body() body: AddMeaningReqDTO): Promise<AddMeaningResT> {
    return this.enMeaningService.addMeaning(body);
  }

  @UseGuards(AdminGuard)
  @Patch('meaning')
  async editMeaning(@Body() body: EditMeaningReqDTO): Promise<EditMeaningResT> {
    return this.enMeaningService.editMeaning(body);
  }

  @UseGuards(AdminGuard)
  @Delete('meaning/:id')
  async deleteMeaning(@Param('id') id: string): Promise<DeleteMeaningResT> {
    return this.enMeaningService.deleteMeaning(+id);
  }
}
