import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddMeaningResT, DeleteMeaningResT, EditMeaningResT } from '../../../../../types';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { AddMeaningReqDTO } from './dto/AddMeaningReq.dto';
import { EditMeaningReqDTO } from './dto/EditMeaningReq.dto';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaningTranslationService } from '../EnMeaningTranslation/enMeaningTranslation.service';

@Injectable()
export class EnMeaningService {
  private readonly logger = new Logger(EnMeaningService.name);

  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    private readonly enMeaningTranslationService: EnMeaningTranslationService,
  ) {}

  async addMeaning(body: AddMeaningReqDTO): Promise<AddMeaningResT> {
    const { word_id, id: _id, ...newMeaning } = body;
    const word = await this.enWordsRep.findOne({ where: { id: word_id } });

    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const res = await this.enMeaningsRep.save({ word: word, ...newMeaning });
    if (body.translations.length > 0) {
      for (const translation of body.translations) {
        await this.enMeaningTranslationService.addMeaningTranslation({
          meaning_id: res.id,
          ...translation,
        });
      }
    }

    this.logger.log(`Meaning added to word id=${word_id}, id=${res.id}`);

    return { success: true, id: res.id };
  }

  async editMeaning(body: EditMeaningReqDTO): Promise<EditMeaningResT> {
    const meaning = await this.enMeaningsRep.findOne({ where: { id: body.id } });

    if (!meaning) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    if (body.title && body.title !== meaning.title) meaning.title = body.title;
    if (body.definition && body.definition !== meaning.definition) meaning.definition = body.definition;
    if (body.sort_order && body.sort_order !== meaning.sort_order) meaning.sort_order = body.sort_order;
    if (body.meaning_level && body.meaning_level !== meaning.meaning_level)
      meaning.meaning_level = body.meaning_level;
    if (body.language_register !== meaning.language_register)
      meaning.language_register = body.language_register;
    if (body.area_variant && body.area_variant !== meaning.area_variant)
      meaning.area_variant = body.area_variant;
    if (body.examples && body.examples.join() !== meaning.examples.join()) meaning.examples = body.examples;
    if (body.categories && body.categories.join() !== meaning.categories?.join())
      meaning.categories = body.categories;

    await this.enMeaningsRep.save(meaning);
    this.logger.log(`Meaning updated, id=${body.id}`);
    return { success: true };
  }

  async deleteMeaning(id: number): Promise<DeleteMeaningResT> {
    await this.enMeaningsRep.delete({ id });

    this.logger.log(`Meaning deleted, id=${id}`);

    return { success: true };
  }
}
