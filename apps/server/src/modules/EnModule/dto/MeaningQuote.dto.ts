import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class MeaningQuoteDTO {
  @ApiProperty()
  @IsString()
  @Matches(/\S/)
  text!: string;

  @ApiProperty({ type: String, nullable: true, required: false })
  @IsOptional()
  @IsString()
  reference?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    allow_protocol_relative_urls: false,
  })
  source_url?: string | null;
}
