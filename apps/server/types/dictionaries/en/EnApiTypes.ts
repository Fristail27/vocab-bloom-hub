import { ErrorResT } from '../../errors';
import { EnWordT } from '.';
import { AddWordFormReqDTO } from '../../../src/modules/EnModule/dto/AddWordFormReq.dto';
import { EditWordFormReqDTO } from '../../../src/modules/EnModule/dto/EditWordFormReq.dto';
import { AddShortTranslationReqDTO } from '../../../src/modules/EnModule/modules/EnShortTranslation/dto/AddShortTranslationReq.dto';
import { EditShortTranslationReqDTO } from '../../../src/modules/EnModule/modules/EnShortTranslation/dto/EditShortTranslationReq.dto';
import { AddMeaningReqDTO } from '../../../src/modules/EnModule/modules/EnMeaning/dto/AddMeaningReq.dto';
import { EditMeaningReqDTO } from '../../../src/modules/EnModule/modules/EnMeaning/dto/EditMeaningReq.dto';
import { AddMeaningTranslationReqDTO } from '../../../src/modules/EnModule/modules/EnMeaningTranslation/dto/AddMeaningTranslationReq.dto';
import { EditMeaningTranslationReqDTO } from '../../../src/modules/EnModule/modules/EnMeaningTranslation/dto/EditMeaningTranslationReq.dto';
import { EditCommonInfoOfWordReqDTO } from '../../../src/modules/EnModule/dto/EditCommonInfoOfWordReq.dto';
import { EditPhrasalBaseReqDTO } from '../../../src/modules/EnModule/dto/EditPhrasalBase.dto';
import { ImportDictionaryReq } from '../../../src/modules/EnModule/modules/EnImportDictionary/dto/ImportDictionaryReq.dto';
import { EnDictionaryImportPhasesE } from '../../../src/modules/EnModule/modules/EnImportDictionary/constants';

export type CheckWordResT = { hasWord: boolean; id?: number } | ErrorResT;
export type AddResT = EnWordT | ErrorResT;
export type SearchResT = EnWordT[] | ErrorResT;
export type DeleteResT = { success: boolean } | ErrorResT;
export type AddWordFormResT = { success: boolean; id: number } | ErrorResT;
export type AddWordFormReqT = AddWordFormReqDTO;
export type EditWordFormResT = { success: boolean } | ErrorResT;
export type EditWordFormReqT = EditWordFormReqDTO;
export type GetWordByIdResT = EnWordT | ErrorResT;

export type AddShortTranslationReqT = AddShortTranslationReqDTO;
export type AddShortTranslationResT = { success: boolean; id: number } | ErrorResT;
export type DeleteShortTranslationResT = { success: boolean } | ErrorResT;
export type EditShortTranslationResT = { success: boolean } | ErrorResT;
export type EditShortTranslationReqT = EditShortTranslationReqDTO;

export type AddMeaningReqT = AddMeaningReqDTO;
export type AddMeaningResT = { success: boolean; id: number } | ErrorResT;
export type EditMeaningReqT = EditMeaningReqDTO;
export type EditMeaningResT = { success: boolean } | ErrorResT;
export type DeleteMeaningResT = { success: boolean } | ErrorResT;

export type AddMeaningTranslationReqT = AddMeaningTranslationReqDTO;
export type AddMeaningTranslationResT = { success: boolean; id: number } | ErrorResT;
export type EditMeaningTranslationReqT = EditMeaningTranslationReqDTO;
export type EditMeaningTranslationResT = { success: boolean } | ErrorResT;
export type DeleteMeaningTranslationResT = { success: boolean } | ErrorResT;

export type EditCommonInfoOfWordReqT = EditCommonInfoOfWordReqDTO;
export type EditCommonInfoOfWordResT = { success: boolean } | ErrorResT;

export type EditPhrasalBaseReqT = EditPhrasalBaseReqDTO;
export type EditPhrasalBaseResT = { success: boolean } | ErrorResT;

export type ImportDictionaryReqT = ImportDictionaryReq;
export type ImportDictionaryChunkT = { percent: number; stage?: EnDictionaryImportPhasesE | undefined };
