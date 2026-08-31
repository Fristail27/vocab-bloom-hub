import { Inject, Optional, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditActionE, AuditEntityTypeE } from '../../../../../types';
import { AuditService } from '../../../AuditModule/audit.service';
import { diffSnapshots, snapshotScalars } from '../../../AuditModule/audit-diff';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
import { markEntryUserModified } from '../../utils/markEntryUserModified';

@Injectable()
export class EnShortTranslationService {
  private readonly logger = new Logger(EnShortTranslationService.name);
  // the audit journal records every admin mutation (issue #334); optional so
  // test modules that boot without AuditModule still resolve
  @Optional()
  @Inject(AuditService)
  private readonly auditService?: AuditService;

  constructor(
    @InjectRepository(EnWord)
    private readonly enWordsRep: Repository<EnWord>,

    @InjectRepository(EnShortTranslation)
    private readonly enShortTranslationRep: Repository<EnShortTranslation>,
  ) {}

  async addShortTranslation(
    body: AddShortTranslationReqDTO,
    manager?: EntityManager,
  ): Promise<AddShortTranslationResT> {
    const em = manager ?? this.enShortTranslationRep.manager;
    const word = await em
      .getRepository(EnWord)
      .findOne({ where: { id: body.word_id }, relations: { word: true } });

    if (!word) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const res = await em.getRepository(EnShortTranslation).save({
      word: word,
      language: body.language,
      description: body.description,
      variants_of_words: body.variant_of_words,
    });

    await markEntryUserModified(em, word.word.word);
    this.logger.log(`Short translation added to word id=${body.word_id}, id=${res.id}`);
    // inside addWord's transaction the word's own create row is enough
    if (!manager) {
      await this.auditService?.record({
        action: AuditActionE.create,
        entityType: AuditEntityTypeE.short_translation,
        entityId: res.id,
        headword: word.word.word,
      });
    }

    return { success: true, id: res.id };
  }

  async deleteShortTranslation(id: number): Promise<DeleteShortTranslationResT> {
    // loaded first only for the journal: the headword survives the delete
    const tr = await this.enShortTranslationRep.findOne({
      where: { id },
      relations: { word: { word: true } },
    });
    await this.enShortTranslationRep.delete({ id });
    if (tr) {
      await markEntryUserModified(this.enShortTranslationRep.manager, tr.word.word.word);
    }
    this.logger.log(`Short translation deleted, id=${id}`);
    await this.auditService?.record({
      action: AuditActionE.delete,
      entityType: AuditEntityTypeE.short_translation,
      entityId: id,
      headword: tr?.word.word.word ?? null,
    });
    return { success: true };
  }

  async editShortTranslation(body: EditShortTranslationReqDTO): Promise<EditShortTranslationResT> {
    const tr = await this.enShortTranslationRep.findOne({
      where: { id: body.id },
      relations: { word: { word: true } },
    });

    if (!tr) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const before = snapshotScalars(tr);
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
    await markEntryUserModified(this.enShortTranslationRep.manager, tr.word.word.word);
    this.logger.log(`Short translation updated, id=${body.id}`);
    await this.auditService?.record({
      action: AuditActionE.update,
      entityType: AuditEntityTypeE.short_translation,
      entityId: body.id,
      headword: tr.word.word.word,
      diff: diffSnapshots(before, snapshotScalars(tr)),
    });
    return { success: true };
  }
}
