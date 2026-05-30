import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnService } from './en.service';

@ApiTags('En_Words')
@Controller('/api/en/')
export class EnController {
  constructor(private readonly enService: EnService) {}
}
