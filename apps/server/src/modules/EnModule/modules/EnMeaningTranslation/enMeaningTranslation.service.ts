import { Inject, Optional, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditActionE, AuditEntityTypeE } from '../../../../../types';
import { AuditService } from '../../../AuditModule/audit.service';
import { diffSnapshots, snapshotScalars } from '../../../AuditModule/audit-diff';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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
  private readonly logger = new Logger(EnMeaningTranslationService.name);
  // the audit journal records every admin mutation (issue #334); optional so
  // test modules that boot without AuditModule still resolve
  @Optional()
  @Inject(AuditService)
  private readonly auditService?: AuditService;

  constructor(
    @InjectRepository(EnMeaning)
    private readonly enMeaningsRep: Repository<EnMeaning>,

    @InjectRepository(EnMeaningTranslation)
    private readonly enMeaningTranslationRep: Repository<EnMeaningTranslation>,
  ) {}

  async addMeaningTranslation(
    body: AddMeaningTranslationReqT,
    manager?: EntityManager,
  ): Promise<AddMeaningTranslationResT> {
    const em = manager ?? this.enMeaningTranslationRep.manager;
    const { meaning_id, id: _id, ...newMeaning } = body;
    const meaning = await em.getRepository(EnMeaning).findOne({
      where: { id: meaning_id },
      relations: { word: { word: true } },
    });

    if (!meaning) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const res = await em.getRepository(EnMeaningTranslation).save({ meaning, ...newMeaning });
    this.logger.log(`Meaning translation added to meaning id=${meaning_id}, id=${res.id}`);
    // inside addWord's / addMeaning's transaction the parent row is enough
    if (!manager) {
      await this.auditService?.record({
        action: AuditActionE.create,
        entityType: AuditEntityTypeE.meaning_translation,
        entityId: res.id,
        headword: meaning.word.word.word,
      });
    }
    return { success: true, id: res.id };
  }

  async editMeaningTranslation(body: EditMeaningTranslationReqT): Promise<EditMeaningTranslationResT> {
    const meaningTr = await this.enMeaningTranslationRep.findOne({
      where: { id: body.id },
      relations: { meaning: { word: { word: true } } },
    });

    if (!meaningTr) {
      throw new NotFoundException(ErrorCodes.word_doesnt_found);
    }

    const before = snapshotScalars(meaningTr);

    if (body.title && body.title !== meaningTr.title) meaningTr.title = body.title;
    if (body.definition && body.definition !== meaningTr.definition) meaningTr.definition = body.definition;
    if (body.language && body.language !== meaningTr.language) meaningTr.language = body.language;
    if (body.variant_of_words && body.variant_of_words.join() !== meaningTr.variants_of_words?.join())
      meaningTr.variants_of_words = body.variant_of_words;

    await this.enMeaningTranslationRep.save(meaningTr);
    this.logger.log(`Meaning translation updated, id=${body.id}`);
    await this.auditService?.record({
      action: AuditActionE.update,
      entityType: AuditEntityTypeE.meaning_translation,
      entityId: body.id,
      headword: meaningTr.meaning.word.word.word,
      diff: diffSnapshots(before, snapshotScalars(meaningTr)),
    });
    return { success: true };
  }

  async deleteMeaningTranslation(id: number): Promise<DeleteMeaningTranslationResT> {
    // loaded first only for the journal: the headword survives the delete
    const meaningTr = await this.enMeaningTranslationRep.findOne({
      where: { id },
      relations: { meaning: { word: { word: true } } },
    });
    await this.enMeaningTranslationRep.delete({ id });

    this.logger.log(`Meaning translation deleted, id=${id}`);
    await this.auditService?.record({
      action: AuditActionE.delete,
      entityType: AuditEntityTypeE.meaning_translation,
      entityId: id,
      headword: meaningTr?.meaning.word.word.word ?? null,
    });

    return { success: true };
  }
}
