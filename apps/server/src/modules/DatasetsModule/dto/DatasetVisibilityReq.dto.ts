import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class DatasetVisibilityReqDTO {
  @ApiProperty({ description: 'Whether this dataset is available to public readers' })
  @IsBoolean()
  is_public!: boolean;
}
