import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { AvailableTranslationLanguagesE } from '../../../../types';
import { toArray } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

/** Query of GET /api/v1/words/{word}/translations */
export class HeadwordTranslationsV1QueryDTO {
  @ApiPropertyOptional({
    enum: AvailableTranslationLanguagesE,
    isArray: true,
    description: 'Translation languages; no value means all of them',
  })
  @IsOptional()
  // `?language=` with nothing after it means every language, like an omitted key
  @Transform(({ value }: { value: unknown }) => {
    const values = toArray({ value }).filter((v) => v !== '');
    return values.length ? values : undefined;
  })
  @IsArray()
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  language?: AvailableTranslationLanguagesE[];
}
