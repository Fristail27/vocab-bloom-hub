import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginReqDTO {
  // HMAC-SHA256 hex digest of the current time slot + salt, keyed by the credentials hash
  @ApiProperty()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  hash!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[0-9a-f]{16,64}$/)
  salt!: string;
}
