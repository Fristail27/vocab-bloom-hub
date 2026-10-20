import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReviewScopeE, ReviewStatusE } from '../../../../../types/reviews';

export class SetContentReviewDTO {
  @ApiProperty()
  @IsBoolean()
  checked!: boolean;

  @ApiProperty({ description: 'Exact content from the displayed portion, guards against concurrent edits' })
  @IsString()
  @MaxLength(1000000)
  expected!: string;
}
export class ReviewWordsQueryDTO {
  @ApiProperty({ enum: ReviewScopeE })
  @IsEnum(ReviewScopeE)
  scope!: ReviewScopeE;

  @ApiPropertyOptional({ enum: ReviewStatusE })
  @IsOptional()
  @IsEnum(ReviewStatusE)
  status?: ReviewStatusE;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
