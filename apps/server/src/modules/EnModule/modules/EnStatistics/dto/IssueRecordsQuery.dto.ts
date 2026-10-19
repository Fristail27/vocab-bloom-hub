import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EN_STATISTICS_ISSUE_KEYS, type EnStatisticsIssueKeyT } from '../../../../../../types';

export class IssueRecordsQueryDto {
  @ApiProperty({ enum: [...EN_STATISTICS_ISSUE_KEYS] })
  @IsIn(EN_STATISTICS_ISSUE_KEYS)
  category!: EnStatisticsIssueKeyT;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
