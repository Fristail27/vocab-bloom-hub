import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { EnStatisticsService } from './enStatistics.service';
import { EnIssuesStatisticsT, EnStatisticsT, EnTranslationsStatisticsT } from '../../../../../types';

@ApiTags('En_Statistics')
@Controller('/api/en/statistics')
export class EnStatisticsController {
  constructor(private readonly enStatisticsService: EnStatisticsService) {}

  @UseGuards(AdminGuard)
  @Get('/')
  async getStatistics(): Promise<EnStatisticsT> {
    return this.enStatisticsService.getStatistics();
  }

  @UseGuards(AdminGuard)
  @Get('translations')
  async getTranslationsStatistics(): Promise<EnTranslationsStatisticsT> {
    return this.enStatisticsService.getTranslationsStatistics();
  }

  @UseGuards(AdminGuard)
  @Get('issues')
  async getIssuesStatistics(): Promise<EnIssuesStatisticsT> {
    return this.enStatisticsService.getIssuesStatistics();
  }
}
