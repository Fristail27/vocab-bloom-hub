import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddSettingReqDTO {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  field!: string;

  @ApiProperty()
  @IsString()
  value!: string;
}
