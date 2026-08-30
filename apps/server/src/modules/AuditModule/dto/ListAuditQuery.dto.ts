import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditActionE, AuditEntityTypeE, AuditTriggerE } from '../../../../types';
import { PaginationQueryDTO, toArray } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

/** Filters of the audit listing (GET /api/en/audit, issue #334) */
export class ListAuditQueryDTO extends PaginationQueryDTO {
  @ApiPropertyOptional({ enum: AuditEntityTypeE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(AuditEntityTypeE, { each: true })
  entity_type?: AuditEntityTypeE[];

  @ApiPropertyOptional({ enum: AuditActionE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(AuditActionE, { each: true })
  action?: AuditActionE[];

  @ApiPropertyOptional({ enum: AuditTriggerE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(AuditTriggerE, { each: true })
  trigger?: AuditTriggerE[];

  @ApiPropertyOptional({ description: 'Headword prefix, case-insensitive' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  @ApiPropertyOptional({ description: 'Only rows at or after this ISO 8601 time' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Only rows at or before this ISO 8601 time' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
