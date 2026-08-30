import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditListT } from '../../../types';
import { AdminGuard } from '../AuthModule/guards/admin.guard';
import { AuditService } from './audit.service';
import { ListAuditQueryDTO } from './dto/ListAuditQuery.dto';

/** The history of admin changes (issue #334): admin surface only, never exported */
@ApiTags('Audit')
@Controller('/api/en/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(AdminGuard)
  async list(@Query() query: ListAuditQueryDTO): Promise<AuditListT> {
    return this.auditService.list(query);
  }
}
