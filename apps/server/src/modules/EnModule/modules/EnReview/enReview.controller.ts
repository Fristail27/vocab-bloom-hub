import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { ApiDatasetQuery } from '../../../DatasetsModule/api-dataset-query';
import { ReviewScopeE } from '../../../../../types/reviews';
import { EnReviewService } from './enReview.service';
import { ReviewWordsQueryDTO, SetContentReviewDTO } from './dto';

@ApiTags('En_Review')
@ApiDatasetQuery()
@UseGuards(AdminGuard)
@Controller('/api/en/reviews')
export class EnReviewController {
  constructor(private readonly reviews: EnReviewService) {}

  @Get('words')
  words(@Query() query: ReviewWordsQueryDTO) {
    return this.reviews.words(query);
  }

  @Get('word/:id')
  word(@Param('id', ParseIntPipe) id: number) {
    return this.reviews.word(id);
  }

  @Post(':scope/:id')
  @HttpCode(200)
  set(
    @Param('scope', new ParseEnumPipe(ReviewScopeE)) scope: ReviewScopeE,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetContentReviewDTO,
  ) {
    return this.reviews.set(scope, id, body);
  }
}
