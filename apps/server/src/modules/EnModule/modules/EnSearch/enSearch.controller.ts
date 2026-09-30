import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicSearchWordV1T } from '../../../../../types';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { SearchV1QueryDTO } from '../../../PublicApiModule/dto/SearchV1Query.dto';
import { EnSearchService } from './enSearch.service';
import { ApiDatasetQuery } from '../../../DatasetsModule/api-dataset-query';

/**
 * The search of the admin UI (issue #540): the flat search of the public
 * API, on the dataset the request works on — the active one, or the one the
 * switch of the admin UI names. The public search serves the active
 * dataset only, and is cached for its consumers.
 */
@ApiTags('En_Words')
// the dataset the request works on (issue #540)
@ApiDatasetQuery()
@Controller('/api/en/search')
export class EnSearchController {
  constructor(private readonly enSearchService: EnSearchService) {}

  @UseGuards(AdminGuard)
  @Get()
  async search(@Query() query: SearchV1QueryDTO): Promise<PublicSearchWordV1T[]> {
    return (await this.enSearchService.searchFlat(query)).items;
  }
}
