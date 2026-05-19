import {Controller, Get, Query} from '@nestjs/common';

import {AuthService} from './auth.service';

@Controller('/api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('login')
    async login(@Query() query: any): Promise<any> {
        return await this.authService.login(query);
    }
}
