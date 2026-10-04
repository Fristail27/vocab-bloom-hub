import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { DownloadDatasetReqT } from '../../../../../types';

export class DownloadDatasetDTO implements DownloadDatasetReqT {
  @ApiPropertyOptional({ description: 'Also download the optional CMUdict pronunciations', default: false })
  @IsOptional()
  @IsBoolean()
  pronunciations?: boolean;
}
