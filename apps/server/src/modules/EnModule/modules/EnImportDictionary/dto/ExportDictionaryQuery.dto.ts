import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsString, Matches, MaxLength } from 'class-validator';
import {
  EXPORT_VERSION_MAX_LENGTH,
  EXPORT_VERSION_PATTERN,
} from '../../../../../../core/constants/export_version';

/** The settings of an export (GET /api/en/dictionary/export) */
export class ExportDictionaryQueryDTO {
  @ApiPropertyOptional({
    description: 'Export only existing current vectors and their manifest; no inference.',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  embeddings_only?: string;

  @ApiPropertyOptional({
    description:
      'The version to write for the entries edited on the instance, in place of `custom_version`. ' +
      'The dictionary is not changed: the entries keep `custom_version` in the database.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(EXPORT_VERSION_MAX_LENGTH)
  @Matches(EXPORT_VERSION_PATTERN)
  edited_version?: string;
}
