import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ImportDictionaryReq {
  @ApiProperty()
  @IsOptional()
  @IsString()
  user_version?: string | undefined;
}
