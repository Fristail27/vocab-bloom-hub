import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ImportSourceKindE } from '../../../../../../types';

export class ImportDictionarySourceDTO {
  @ApiProperty({ enum: ImportSourceKindE })
  @IsEnum(ImportSourceKindE)
  kind!: ImportSourceKindE;

  // A dataset directory or zip archive relative to DICTIONARY_IMPORT_DIR;
  // required for the file source, ignored otherwise
  @ApiProperty({ required: false })
  @ValidateIf((o: ImportDictionarySourceDTO) => o.kind === ImportSourceKindE.file)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  path?: string | undefined;
}

// Without a source the published HuggingFace dataset is imported; the
// dataset version always comes from its manifest.json, never from the client
export class ImportDictionaryReq {
  @ApiProperty({ type: ImportDictionarySourceDTO, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImportDictionarySourceDTO)
  source?: ImportDictionarySourceDTO | undefined;
}
