import { ErrorResT } from './errors';
import { LoginReqDTO } from '../src/modules/AuthModule/dto/LoginReq.dto';

export enum RoleE {
  admin = 'admin',
}

export type LoginReqBody = LoginReqDTO;

export type LoginResBody = { token: string } | ErrorResT;

export type CheckTokenResBody = { isValid: boolean };

export type LogoutResBody = { success: boolean };
