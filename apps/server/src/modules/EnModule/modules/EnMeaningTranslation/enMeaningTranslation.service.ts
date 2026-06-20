import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import {
  AddMeaningTranslationReqT,
  AddMeaningTranslationResT,
  DeleteMeaningTranslationResT,
  EditMeaningTranslationReqT,
  EditMeaningTranslationResT,
} from '../../../../../types';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';

@Injectable()
export class EnMeaningTranslationService {
  constructor(
    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    @InjectRepository(EnShortTranslation)
    private readonly enMeaningTranslationRep: Repository<EnMeaningTranslation>,
  ) {}

  async addMeaningTranslation(body: AddMeaningTranslationReqT): Promise<AddMeaningTranslationResT> {
    const { meaning_id, ...newMeaning } = body;
    const meaning = await this.enMeaningsRep.findOne({ where: { id: meaning_id } });

    if (!meaning) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const res = await this.enMeaningTranslationRep.save({ meaning, ...newMeaning });
    return { success: true, id: res.id };
  }

  async editMeaningTranslation(body: EditMeaningTranslationReqT): Promise<EditMeaningTranslationResT> {
    const meaningTr = await this.enMeaningTranslationRep.findOne({ where: { id: body.id } });

    if (!meaningTr) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    if (body.title && body.title !== meaningTr.title) meaningTr.title = body.title;
    if (body.definition && body.definition !== meaningTr.definition) meaningTr.definition = body.definition;
    if (body.language && body.language !== meaningTr.language) meaningTr.language = body.language;
    if (body.variant_of_words && body.variant_of_words.join() !== meaningTr.variants_of_words?.join())
      meaningTr.variants_of_words = body.variant_of_words;

    await this.enMeaningTranslationRep.save(meaningTr);
    return { success: true };
  }

  async deleteMeaningTranslation(id: number): Promise<DeleteMeaningTranslationResT> {
    await this.enMeaningTranslationRep.delete({ id });

    return { success: true };
  }
}
