import { SearchReqDTO } from '../../EnModule/modules/EnSearch/dto/SearchReq.dto';
import { SearchDetailedReqDTO } from '../../EnModule/modules/EnSearch/dto/SearchDetailedReq.dto';

// The v1 request shapes are the search DTOs frozen under their own names:
// the admin search may evolve, these stay as they are until /api/v2
export class SearchV1ReqDTO extends SearchReqDTO {}
export class SearchDetailedV1ReqDTO extends SearchDetailedReqDTO {}
