import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit_log.entity';
import { AuditService } from './audit.service';

/**
 * The audit journal (issue #334). Global like ImportStatusModule: the En*
 * and Settings services record into it from wherever they run. The
 * controller is registered by EnModule so the route is matched before
 * GET /api/en/:id.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
