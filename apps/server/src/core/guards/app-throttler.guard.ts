import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorCodes } from '../../../core/constants/error_codes';

/**
 * ThrottlerGuard с кодом ошибки из ErrorCodes, чтобы фронтенд
 * мог перевести сообщение как остальные ошибки API.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = ErrorCodes.too_many_requests;
}
