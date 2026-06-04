import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { validateJwt } from '../../../../core/utils/auth';
import { hashLoginString } from '../../../../core/utils/crypto';
import { ErrorCodes } from '../../../../core/constants/error_codes';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization.replace('Bearer ', '');
    const username = process.env.USERNAME as string;
    const pass = process.env.PASSWORD as string;
    const hashByEnv = await hashLoginString(username, pass);
    const secretHash = await hashLoginString(username, hashByEnv);
    const isValid = validateJwt(token, secretHash + hashByEnv);

    if (!isValid) {
      throw new ForbiddenException(ErrorCodes.invalid_token);
    }

    return true;
  }
}
