import { AbstractBaseApi } from '../AbstractBaseApi';
import {
  AddMeaningReqT,
  AddMeaningResT,
  AddMeaningTranslationReqT,
  AddMeaningTranslationResT,
  AddResT,
  AddShortTranslationReqT,
  AddShortTranslationResT,
  AddWordFormReqT,
  AddWordFormResT,
  DeleteMeaningResT,
  DeleteMeaningTranslationResT,
  DeleteResT,
  DeleteShortTranslationResT,
  EditCommonInfoOfWordReqT,
  EditCommonInfoOfWordResT,
  EditMeaningReqT,
  EditMeaningResT,
  EditMeaningTranslationReqT,
  EditMeaningTranslationResT,
  EditShortTranslationReqT,
  EditShortTranslationResT,
  EditWordFormReqT,
  EditWordFormResT,
  EnPartOfSpeechE,
  EnWordT,
  GetWordByIdResT,
  SearchResT,
} from 'server/types';
import { CheckWordResT } from 'server/types';

export class EnApi extends AbstractBaseApi {
  static async checkWord(word: string, pos: EnPartOfSpeechE): Promise<CheckWordResT> {
    return this.get<CheckWordResT>(`${this.baseURL}/en/check-word/${word}`, { query: { partOfSpeech: pos } });
  }

  static async addWord(data: EnWordT): Promise<AddResT> {
    return this.post<AddResT>(`${this.baseURL}/en/add/word`, data);
  }

  static async search(search: string): Promise<SearchResT> {
    return this.post<SearchResT>(`${this.baseURL}/en/search`, { search });
  }

  static async deleteWord(id: number): Promise<DeleteResT> {
    return this.delete<DeleteResT>(`${this.baseURL}/en/${id}`);
  }

  static async editCommonInfoOfWord(
    id: string | number,
    data: EditCommonInfoOfWordReqT,
  ): Promise<EditCommonInfoOfWordResT> {
    return this.patch<EditCommonInfoOfWordResT>(`${this.baseURL}/en/common-info/${id}`, data);
  }

  static async getWordById(id: number): Promise<GetWordByIdResT> {
    return this.get<GetWordByIdResT>(`${this.baseURL}/en/${id}`);
  }

  static async addWordForm(body: AddWordFormReqT): Promise<AddWordFormResT> {
    return this.post<AddWordFormResT>(`${this.baseURL}/en/word-form`, body);
  }
  static async editWordForm(body: EditWordFormReqT): Promise<EditWordFormResT> {
    return this.patch<EditWordFormResT>(`${this.baseURL}/en/word-form`, body);
  }

  static async addShortTranslation(body: AddShortTranslationReqT): Promise<AddShortTranslationResT> {
    return this.post<AddShortTranslationResT>(`${this.baseURL}/en/word/short-translation`, body);
  }

  static async editShortTranslation(body: EditShortTranslationReqT): Promise<EditShortTranslationResT> {
    return this.patch<EditShortTranslationResT>(`${this.baseURL}/en/word/short-translation`, body);
  }

  static async deleteShortTranslation(id: string | number): Promise<DeleteShortTranslationResT> {
    return this.delete<AddShortTranslationResT>(`${this.baseURL}/en/word/short-translation/${id}`);
  }

  static async addMeaning(body: AddMeaningReqT): Promise<AddMeaningResT> {
    return this.post<AddMeaningResT>(`${this.baseURL}/en/meaning`, body);
  }

  static async editMeaning(body: EditMeaningReqT): Promise<EditMeaningResT> {
    return this.patch<EditMeaningResT>(`${this.baseURL}/en/meaning`, body);
  }

  static async deleteMeaning(id: string | number): Promise<DeleteMeaningResT> {
    return this.delete<DeleteMeaningResT>(`${this.baseURL}/en/meaning/${id}`);
  }

  static async addMeaningTranslation(body: AddMeaningTranslationReqT): Promise<AddMeaningTranslationResT> {
    return this.post<AddMeaningTranslationResT>(`${this.baseURL}/en/meaning-translation`, body);
  }

  static async editMeaningTranslation(body: EditMeaningTranslationReqT): Promise<EditMeaningTranslationResT> {
    return this.patch<EditMeaningTranslationResT>(`${this.baseURL}/en/meaning-translation`, body);
  }

  static async deleteMeaningTranslation(id: string | number): Promise<DeleteMeaningTranslationResT> {
    return this.delete<DeleteMeaningTranslationResT>(`${this.baseURL}/en/meaning-translation/${id}`);
  }
}
