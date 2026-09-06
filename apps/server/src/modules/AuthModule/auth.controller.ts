import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import type { CheckTokenResBody, LoginResBody, LogoutResBody } from '../../../types';
import { AuthService } from './auth.service';
import { LoginReqDTO } from './dto/LoginReq.dto';
import { AppThrottlerGuard } from '../../core/guards/app-throttler.guard';
import { getBearerFromRequest } from '../../core/utils/get-bearer-from-request';

@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() { hash, salt }: LoginReqDTO,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<LoginResBody> {
    const token = await this.authService.login(hash, salt);
    this.authService.setTokenToCookie(token, res, req);

    return { token };
  }

  @Get('check-token')
  async checkToken(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CheckTokenResBody> {
    const jwt = getBearerFromRequest(req);
    if (!jwt) {
      return { isValid: false };
    }
    const isValid = await this.authService.checkToken(jwt);

    if (isValid) {
      const newToken = await this.authService.createJwtToken();
      this.authService.setTokenToCookie(newToken, res, req);
    }
    return { isValid };
  }

  /**
   * Drops the httpOnly bearer cookie — the browser cannot clear it itself
   * (issue #398). No guard: an expired or rotated token is exactly when the
   * admin needs the cookie gone
   */
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): LogoutResBody {
    this.authService.clearTokenCookie(res, req);

    return { success: true };
  }
}
