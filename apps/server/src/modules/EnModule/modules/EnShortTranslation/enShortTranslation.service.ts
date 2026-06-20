import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import {
  AddShortTranslationResT,
  DeleteShortTranslationResT,
  EditShortTranslationResT,
} from '../../../../../types';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import { AddShortTranslationReqDTO } from './dto/AddShortTranslationReq.dto';
import { EditShortTranslationReqDTO } from './dto/EditShortTranslationReq.dto';

@Injectable()
export class EnShortTranslationService {
  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnShortTranslation)
    private readonly enShortTranslationRep: Repository<EnShortTranslation>,
  ) {}

  async addShortTranslation(body: AddShortTranslationReqDTO): Promise<AddShortTranslationResT> {
    const word = await this.enWordsRep.findOne({ where: { id: body.word_id } });

    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const res = await this.enShortTranslationRep.save({
      word: word,
      language: body.language,
      description: body.description,
      variants_of_words: body.variant_of_words,
    });

    return { success: true, id: res.id };
  }

  async deleteShortTranslation(id: number): Promise<DeleteShortTranslationResT> {
    await this.enShortTranslationRep.delete({ id });
    return { success: true };
  }

  async editShortTranslation(body: EditShortTranslationReqDTO): Promise<EditShortTranslationResT> {
    const tr = await this.enShortTranslationRep.findOne({ where: { id: body.id } });

    if (!tr) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }
    if (body.description && body.description !== tr.description) {
      tr.description = body.description;
    }
    if (body.language && body.language !== tr.language) {
      tr.language = body.language;
    }

    if (body.variant_of_words && body.variant_of_words.join() !== tr.variants_of_words.join()) {
      tr.variants_of_words = body.variant_of_words;
    }

    await this.enShortTranslationRep.save(tr);
    return { success: true };
  }
}
