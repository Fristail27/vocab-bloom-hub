import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorCodes } from '../../../core/constants/error_codes';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = ErrorCodes.too_many_requests;
}
