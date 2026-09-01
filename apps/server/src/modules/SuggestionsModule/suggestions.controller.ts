import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApplySuggestionResT,
  DeleteSuggestionResT,
  ListSuggestionsResT,
  UpdateSuggestionStatusResT,
} from '../../../types';
import { AdminGuard } from '../AuthModule/guards/admin.guard';
import { ListSuggestionsQueryDTO } from './dto/ListSuggestionsQuery.dto';
import { UpdateSuggestionStatusReqDTO } from './dto/UpdateSuggestionStatusReq.dto';
import { SuggestionApplyService } from './suggestion-apply.service';
import { SuggestionsService } from './suggestions.service';

// The moderation queue of the reader reports (issue #327), admin only
@ApiTags('Suggestions')
@Controller('/api/en/suggestions')
export class SuggestionsController {
  constructor(
    private readonly suggestionsService: SuggestionsService,
    private readonly suggestionApplyService: SuggestionApplyService,
  ) {}

  // One-click accept of an edit suggestion: the stored values go through
  // the normal edit flow (validated, audited, flags the entry user_modified)
  @UseGuards(AdminGuard)
  @Post(':id/apply')
  async apply(@Param('id', ParseIntPipe) id: number): Promise<ApplySuggestionResT> {
    return this.suggestionApplyService.apply(id);
  }

  @UseGuards(AdminGuard)
  @Get()
  async list(@Query() query: ListSuggestionsQueryDTO): Promise<ListSuggestionsResT> {
    return this.suggestionsService.list(query);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSuggestionStatusReqDTO,
  ): Promise<UpdateSuggestionStatusResT> {
    return this.suggestionsService.updateStatus(id, body.status);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<DeleteSuggestionResT> {
    return this.suggestionsService.delete(id);
  }
}
