import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnEntry } from './entities/en_entry.entity';
import { EnWord } from './entities/en_word.entity';
import { EnMeaning } from './entities/en_meaning.entity';
import { EnMeaningTranslation } from './entities/en_meaning_translation.entity';
import { EnShortTranslation } from './entities/en_short_translation.entity';

@Injectable()
export class EnService {
  constructor(
    @InjectRepository(EnEntry)
    private readonly EnEntriesRep: Repository<EnEntry>,

    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    @InjectRepository(EnMeaningTranslation)
    private readonly enMeaningTranslationRep: Repository<EnMeaningTranslation>,

    @InjectRepository(EnShortTranslation)
    private readonly enShortTranslationRep: Repository<EnShortTranslation>,
  ) {}
}
