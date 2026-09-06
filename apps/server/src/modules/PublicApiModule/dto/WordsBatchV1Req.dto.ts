import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length, Matches } from 'class-validator';
import { HEADWORD_MAX_LENGTH } from '../utils/headword-param.pipe';

/** Spellings one batch lookup may carry (issue #397) */
export const PUBLIC_BATCH_MAX_WORDS = 50;

/** Body of POST /api/v1/words/batch: the spellings to look up */
export class WordsBatchV1ReqDTO {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: PUBLIC_BATCH_MAX_WORDS,
    description:
      `Headword spellings, ${PUBLIC_BATCH_MAX_WORDS} at most, each matched like GET /words/{word} ` +
      '(case-insensitively; an inflected form resolves to its base entry)',
    example: ['run', 'ran', 'put up with'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PUBLIC_BATCH_MAX_WORDS)
  @IsString({ each: true })
  @Length(1, HEADWORD_MAX_LENGTH, { each: true })
  // a blank spelling would normalize to nothing and vanish from the answer
  @Matches(/\S/, { each: true, message: 'each word must contain a non-blank character' })
  words!: string[];
}
