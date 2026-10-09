import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import type { OriginLicenseT } from '../../../../types';
import { IsAudioLicenses } from '../utils/pronunciationAudio';

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };
export class PronunciationAudioDTO {
  @ApiProperty({ required: false, description: 'Existing ID on edit; ignored on copy/import.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty()
  @IsUrl(URL_OPTIONS)
  @MaxLength(8000)
  url!: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(8000)
  source_url?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  attribution?: string | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'OriginLicenseT records: name, url, optional spdx/text. Unknown terms are []. Never inherited from text.',
  })
  @IsAudioLicenses()
  licenses!: OriginLicenseT[];

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  sort_order!: number;
}
