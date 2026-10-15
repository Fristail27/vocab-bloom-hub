import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { AdminGuard } from '../../../AuthModule/guards/admin.guard';
import { ReconciliationService } from './reconciliation.service';
import type {
  ReconciliationCategoryT,
  ReconciliationDecisionT,
  ReconciliationSideT,
} from '../../../../../types/reconciliation';

class ParentReq {
  @IsOptional()
  @IsBoolean()
  allow_two_way?: boolean;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,39}$/)
  source!: string;
}
class ItemQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000000)
  page?: number;

  @IsOptional()
  @IsIn(['added', 'deleted', 'changed', 'conflicts', 'local_only', 'unchanged'])
  category?: ReconciliationCategoryT;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;
}
class DecisionReq implements ReconciliationDecisionT {
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  path!: string[];

  @IsIn(['local', 'incoming', 'custom'])
  choice!: 'local' | 'incoming' | 'custom';

  @IsOptional()
  @IsObject()
  result?: ReconciliationSideT;
}
class DecisionsReq {
  @IsString()
  @MaxLength(128)
  headword!: string;

  @IsInt()
  @Min(0)
  version!: number;

  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => DecisionReq)
  decisions!: DecisionReq[];
}
class OverrideReq {
  @IsString()
  @MaxLength(128)
  headword!: string;
  @IsInt()
  @Min(0)
  version!: number;
  @IsObject()
  result!: ReconciliationSideT;
}

@ApiTags('Dataset reconciliation')
@Controller('/api/en/datasets/:name/reconciliation')
@UseGuards(AdminGuard)
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get()
  list(@Param('name') name: string, @Query() query: ItemQuery) {
    return this.service.list(name, query.search);
  }

  @Post('parent')
  prepare(@Param('name') name: string, @Body() body: ParentReq) {
    return this.service.prepareParent(name, body.source, body.allow_two_way);
  }

  @Get(':id')
  summary(@Param('name') name: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.summary(name, id);
  }

  @Get(':id/items')
  items(@Param('name') name: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: ItemQuery) {
    return this.service.items(name, id, query.page ?? 1, query.category, query.search);
  }

  @Post(':id/decisions')
  @HttpCode(200)
  decide(@Param('name') name: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: DecisionsReq) {
    return this.service.decide(name, id, body.headword, body.version, body.decisions);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('name') name: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.cancel(name, id);
    return { success: true };
  }

  @Post(':id/result')
  @HttpCode(200)
  override(@Param('name') name: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: OverrideReq) {
    return this.service.override(name, id, body.headword, body.version, body.result);
  }

  @Post(':id/apply')
  @HttpCode(200)
  apply(@Param('name') name: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.apply(name, id);
  }
}
