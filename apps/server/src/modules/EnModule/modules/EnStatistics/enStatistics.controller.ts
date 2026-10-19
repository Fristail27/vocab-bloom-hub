import { IssueRecordsQueryDto } from './dto/IssueRecordsQuery.dto';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { EnStatisticsService } from './enStatistics.service';
import {
  EnIssueRecordsT,
  EnIssuesStatisticsT,
  EnStatisticsT,
  EnTranslationsStatisticsT,
} from '../../../../../types';
import { ApiDatasetQuery } from '../../../DatasetsModule/api-dataset-query';

@ApiTags('En_Statistics')
// the dataset the request works on (issue #540)
@ApiDatasetQuery()
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
  @Get('issues/records')
  async getIssueRecords(@Query() query: IssueRecordsQueryDto): Promise<EnIssueRecordsT> {
    return this.enStatisticsService.getIssueRecords(query);
  }

  @UseGuards(AdminGuard)
  @Get('issues')
  async getIssuesStatistics(): Promise<EnIssuesStatisticsT> {
    return this.enStatisticsService.getIssuesStatistics();
  }
}
