import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SuggestionStatusE } from '../../../../types';

// PATCH /api/en/suggestions/:id — the moderation verdict (issue #327)
export class UpdateSuggestionStatusReqDTO {
  @ApiProperty({ enum: SuggestionStatusE })
  @IsEnum(SuggestionStatusE)
  status!: SuggestionStatusE;
}
