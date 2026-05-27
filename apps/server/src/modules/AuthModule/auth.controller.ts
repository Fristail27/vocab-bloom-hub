import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import type {
  CheckTokenResBody,
  LoginReqBody,
  LoginResBody,
} from '../../../types';
import { AuthService } from './auth.service';

@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() { hash }: LoginReqBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResBody> {
    const token = await this.authService.login(hash);
    this.authService.setTokenToCookie(token, res);

    return { token };
  }

  @Get('check-token')
  async checkToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CheckTokenResBody> {
    if (!req.headers.authorization) {
      return { isValid: false };
    }
    const jwt = req.headers.authorization.replace('Bearer ', '');
    const isValid = await this.authService.checkToken(jwt);

    if (isValid) {
      const newToken = await this.authService.createJwtToken();
      this.authService.setTokenToCookie(newToken, res);
    }
    return { isValid };
  }
}
