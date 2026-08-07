import { Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnSearchService } from './enSearch.service';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { SearchResT } from '../../../../../types';
import { ErrorCodes } from '../../../../../core/constants/error_codes';

@ApiTags('En_Words')
@Controller('/api/en/search/')
export class EnSearchController {
  constructor(private readonly enSearchService: EnSearchService) {}

  @Post('/')
  async search(@Body() body: SearchReqDTO): Promise<SearchResT> {
    try {
      return this.enSearchService.search(body);
    } catch {
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }
}
