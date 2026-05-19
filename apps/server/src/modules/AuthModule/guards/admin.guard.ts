import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import {RoleE} from "@vb/shared-types";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.role.includes(RoleE.admin)) {
      throw new ForbiddenException('Admins only');
    }

    return true;
  }
}
