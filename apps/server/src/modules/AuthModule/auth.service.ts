import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import jwt, { Secret } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor() {}
  async login(query: any): Promise<any> {}
}
