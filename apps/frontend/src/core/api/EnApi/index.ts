import { AbstractBaseApi } from '../AbstractBaseApi';
import { AddResT, DeleteResT, EnPartOfSpeechE, EnWordT, SearchResT } from 'server/types';
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
}
