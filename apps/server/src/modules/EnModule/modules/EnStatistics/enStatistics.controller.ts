import { IssueRecordsQueryDto } from './dto/IssueRecordsQuery.dto';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { EnStatisticsService } from './enStatistics.service';
import {
  EnIssueRecordsT,
  EnIssuesStatisticsT,
  EnStatisticsT,
  EnDatasetsStatisticsT,
  EnTranslationsStatisticsT,
} from '../../../../../types';
import { ApiDatasetQuery } from '../../../DatasetsModule/api-dataset-query';

@ApiTags('En_Statistics')
@Controller('/api/en/statistics')
export class EnStatisticsController {
  constructor(private readonly enStatisticsService: EnStatisticsService) {}

  @UseGuards(AdminGuard)
  @ApiDatasetQuery()
  @Get('/')
  async getStatistics(): Promise<EnStatisticsT> {
    return this.enStatisticsService.getStatistics();
  }

  @UseGuards(AdminGuard)
  @Get('datasets')
  async getDatasetsStatistics(): Promise<EnDatasetsStatisticsT> {
    return this.enStatisticsService.getDatasetsStatistics();
  }

  @UseGuards(AdminGuard)
  @ApiDatasetQuery()
  @Get('translations')
  async getTranslationsStatistics(): Promise<EnTranslationsStatisticsT> {
    return this.enStatisticsService.getTranslationsStatistics();
  }

  @UseGuards(AdminGuard)
  @ApiDatasetQuery()
  @Get('issues/records')
  async getIssueRecords(@Query() query: IssueRecordsQueryDto): Promise<EnIssueRecordsT> {
    return this.enStatisticsService.getIssueRecords(query);
  }

  @UseGuards(AdminGuard)
  @ApiDatasetQuery()
  @Get('issues')
  async getIssuesStatistics(): Promise<EnIssuesStatisticsT> {
    return this.enStatisticsService.getIssuesStatistics();
  }
}
