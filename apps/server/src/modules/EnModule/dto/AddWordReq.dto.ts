import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  AvailableTranslationLanguagesE,
  CategoryE,
  EnAreaVariantsE,
  EnMeaningT,
  EnPartOfSpeechE,
  EnPhrasalObjectPatternE,
  EnShortTranslationT,
  EnVerbTransitivityE,
  EnWordFormsE,
  EnWordFormT,
  EnWordT,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../types';
import { MeaningTranslationDto } from '../modules/EnMeaningTranslation/dto/MeaningTranslation.dto';

// The admin UI sends null for untouched fields, but these columns are NOT NULL
// with a DB default; dropping the value lets TypeORM apply that default
const NullMeansColumnDefault = Transform(({ value }: { value: unknown }) => value ?? undefined);

export class AddWordReqFormDTO {
  // Client-side ids may leak through for already-persisted rows; the service ignores them
  @IsOptional()
  @IsNumber()
  id?: EnWordFormT['id'] | undefined;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  word!: EnWordFormT['word'];

  @ApiProperty()
  @IsEnum(EnWordFormsE)
  form_of_word!: EnWordFormT['form_of_word'];

  @ApiProperty()
  @IsEnum(EnAreaVariantsE)
  area_variant!: EnWordFormT['area_variant'];

  @ApiProperty()
  @IsOptional()
  @IsString()
  transcription?: EnWordFormT['transcription'] | undefined;

  @ApiProperty()
  @NullMeansColumnDefault
  @IsOptional()
  @IsBoolean()
  is_obsolete?: EnWordFormT['is_obsolete'] | undefined;
}

export class AddWordReqShortTranslationDTO {
  @IsOptional()
  @IsNumber()
  id?: EnShortTranslationT['id'] | undefined;

  @ApiProperty()
  @IsEnum(AvailableTranslationLanguagesE)
  language!: EnShortTranslationT['language'];

  @ApiProperty()
  @IsString()
  description!: EnShortTranslationT['description'];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  variants_of_words!: EnShortTranslationT['variants_of_words'];
}

export class AddWordReqMeaningDTO {
  @IsOptional()
  @IsNumber()
  id?: EnMeaningT['id'] | undefined;

  @ApiProperty()
  @IsString()
  title!: EnMeaningT['title'];

  @ApiProperty()
  @IsString()
  definition!: EnMeaningT['definition'];

  @ApiProperty()
  @IsBoolean()
  is_obsolete!: EnMeaningT['is_obsolete'];

  @ApiProperty()
  @IsNumber()
  sort_order!: EnMeaningT['sort_order'];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  examples!: EnMeaningT['examples'];

  @ApiProperty()
  @IsEnum(EnAreaVariantsE)
  area_variant!: EnMeaningT['area_variant'];

  @ApiProperty()
  @IsOptional()
  @IsEnum(WordLevelE)
  meaning_level?: EnMeaningT['meaning_level'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(LanguageRegisterE)
  language_register?: EnMeaningT['language_register'] | undefined;

  @ApiProperty({ enum: CategoryE, isArray: true })
  @NullMeansColumnDefault
  @IsOptional()
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  categories?: EnMeaningT['categories'] | undefined;

  @ApiProperty({ type: [MeaningTranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeaningTranslationDto)
  translations!: MeaningTranslationDto[];
}

export class AddWordReqDTO {
  // The admin UI sends its local id (e.g. 0); the server assigns real ids itself
  @IsOptional()
  @IsNumber()
  id?: EnWordT['id'] | undefined;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  word!: EnWordT['word'];

  @ApiProperty()
  @IsEnum(EnPartOfSpeechE)
  part_of_speech!: EnWordT['part_of_speech'];

  @ApiProperty()
  @IsEnum(EnWordFormsE)
  form_of_word!: EnWordT['form_of_word'];

  @ApiProperty()
  @NullMeansColumnDefault
  @IsOptional()
  @IsBoolean()
  generated?: EnWordT['generated'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  generated_by_model?: EnWordT['generated_by_model'] | undefined;

  @ApiProperty()
  @NullMeansColumnDefault
  @IsOptional()
  @IsBoolean()
  is_obsolete?: EnWordT['is_obsolete'] | undefined;

  @ApiProperty()
  @NullMeansColumnDefault
  @IsOptional()
  @IsBoolean()
  is_abbreviation?: EnWordT['is_abbreviation'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(WordLevelE)
  word_level?: EnWordT['word_level'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnAreaVariantsE)
  area_variant?: EnWordT['area_variant'] | undefined;

  @ApiProperty({ enum: CategoryE, isArray: true })
  @NullMeansColumnDefault
  @IsOptional()
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  categories?: EnWordT['categories'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(LanguageRegisterE)
  language_register?: EnWordT['language_register'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: EnWordT['description'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  transcription?: EnWordT['transcription'] | undefined;

  @ApiProperty({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pattern?: EnWordT['pattern'] | undefined;

  @ApiProperty()
  @NullMeansColumnDefault
  @IsOptional()
  @IsString()
  version?: EnWordT['version'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___irregular_plural?: EnWordT['noun___irregular_plural'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___uncountable?: EnWordT['noun___uncountable'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___is_proper?: EnWordT['noun___is_proper'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___always_plural?: EnWordT['noun___always_plural'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  verb___is_irregular?: EnWordT['verb___is_irregular'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnVerbTransitivityE)
  verb___transitivity?: EnWordT['verb___transitivity'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  verb___is_phrasal?: EnWordT['verb___is_phrasal'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnPhrasalObjectPatternE)
  verb___phrasal_object_pattern?: EnWordT['verb___phrasal_object_pattern'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  base_phrasal?: EnWordT['base_phrasal'] | undefined;

  // Present when the payload was pasted from an exported word; the service ignores it
  @IsOptional()
  @IsObject()
  base_form?: EnWordT['base_form'] | undefined;

  @ApiProperty({ isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phrasal_variants?: EnWordT['phrasal_variants'] | undefined;

  @ApiProperty({ type: [AddWordReqFormDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddWordReqFormDTO)
  forms?: AddWordReqFormDTO[] | undefined;

  @ApiProperty({ type: [AddWordReqMeaningDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddWordReqMeaningDTO)
  meanings?: AddWordReqMeaningDTO[] | undefined;

  @ApiProperty({ type: [AddWordReqShortTranslationDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddWordReqShortTranslationDTO)
  short_translations?: AddWordReqShortTranslationDTO[] | undefined;
}
