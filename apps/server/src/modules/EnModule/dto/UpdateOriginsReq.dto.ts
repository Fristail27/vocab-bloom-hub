import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches, IsString, MaxLength } from 'class-validator';
import type { OriginT, UpdateOriginsReqT } from '../../../../types';
import { IsOrigins } from '../../../core/utils/provenance';

export class UpdateOriginsReqDTO implements UpdateOriginsReqT {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsOrigins()
  origins!: OriginT[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(2000)
  reason!: string;
}
