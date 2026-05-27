import { ErrorResT } from './errors';

export enum RoleE {
  admin = 'admin',
}

export type LoginReqBody = { hash: string };

export type LoginResBody = { token: string } | ErrorResT;

export type CheckTokenResBody = { isValid: boolean } | ErrorResT;
