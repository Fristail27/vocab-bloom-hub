import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { EnAdminListsService } from './enAdminLists.service';
import { ListWordsQueryDTO } from './dto/ListWordsQuery.dto';
import { ListMeaningsQueryDTO } from './dto/ListMeaningsQuery.dto';
import { ListMeaningTranslationsQueryDTO } from './dto/ListMeaningTranslationsQuery.dto';
import { EnMeaningsListT, EnMeaningTranslationsListT, EnWordsListT } from '../../../../../types';

/**
 * Admin-only paginated listings behind the bulk-request page. Registered
 * before EnController so these GET routes are not swallowed by GET /api/en/:id
 */
@ApiTags('En_Admin_Lists')
@Controller('/api/en')
export class EnAdminListsController {
  constructor(private readonly enAdminListsService: EnAdminListsService) {}

  @UseGuards(AdminGuard)
  @Get('words')
  async listWords(@Query() query: ListWordsQueryDTO): Promise<EnWordsListT> {
    return this.enAdminListsService.listWords(query);
  }

  @UseGuards(AdminGuard)
  @Get('meanings')
  async listMeanings(@Query() query: ListMeaningsQueryDTO): Promise<EnMeaningsListT> {
    return this.enAdminListsService.listMeanings(query);
  }

  @UseGuards(AdminGuard)
  @Get('meaning-translations')
  async listMeaningTranslations(
    @Query() query: ListMeaningTranslationsQueryDTO,
  ): Promise<EnMeaningTranslationsListT> {
    return this.enAdminListsService.listMeaningTranslations(query);
  }
}
