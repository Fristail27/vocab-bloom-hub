import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SuggestionKindE, SuggestionStatusE } from '../../../../types';
import { PaginationQueryDTO, toArray } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

// GET /api/en/suggestions — the moderation queue listing (issue #327)
export class ListSuggestionsQueryDTO extends PaginationQueryDTO {
  @ApiPropertyOptional({ enum: SuggestionStatusE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(SuggestionStatusE, { each: true })
  status?: SuggestionStatusE[] | undefined;

  @ApiPropertyOptional({ enum: SuggestionKindE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(SuggestionKindE, { each: true })
  kind?: SuggestionKindE[] | undefined;

  /** Headword prefix, case-insensitive */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string | undefined;
}
