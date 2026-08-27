import { INestApplication, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { buildPublicDocument } from '../../openapi/build-openapi';
import { ErrorCodes } from '../../../core/constants/error_codes';

/**
 * Serves the public OpenAPI document from the running application (issue
 * #273). The document is scanned from the application instance, which no
 * provider can inject, so the bootstrap hands it over with `attach()`; the
 * scan runs once, on the first request.
 */
@Injectable()
export class PublicOpenApiService {
  private app: INestApplication | null = null;

  private document: OpenAPIObject | null = null;

  attach(app: INestApplication): void {
    this.app = app;
    this.document = null;
  }

  getPublicDocument(): OpenAPIObject {
    if (!this.document) {
      if (!this.app) {
        throw new ServiceUnavailableException(ErrorCodes.openapi_not_available);
      }
      this.document = buildPublicDocument(this.app);
    }
    return this.document;
  }
}
