import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Width of the en_entries.word column: a longer value can never match */
export const HEADWORD_MAX_LENGTH = 128;

// The :word path params of the public API (issue #345): body fields go
// through the global ValidationPipe, path params need their own cap — an
// oversized value would otherwise run the full lookup tiers for nothing
@Injectable()
export class HeadwordParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > HEADWORD_MAX_LENGTH) {
      throw new BadRequestException(`word must be between 1 and ${HEADWORD_MAX_LENGTH} characters`);
    }
    return value;
  }
}
