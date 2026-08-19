import { AbstractBaseApi, type DownloadedFileT } from '../AbstractBaseApi';
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
  AddWordReqT,
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
  EditPhrasalBaseReqT,
  EditPhrasalBaseResT,
  EditShortTranslationReqT,
  EditShortTranslationResT,
  EditWordFormReqT,
  EditWordFormResT,
  EnIssuesStatisticsT,
  EnPartOfSpeechE,
  EnStatisticsT,
  EnTranslationsStatisticsT,
  ErrorResT,
  GetEnIssuesStatisticsResT,
  GetEnStatisticsResT,
  GetEnTranslationsStatisticsResT,
  GetWordByIdResT,
  GetDatasetManifestResT,
  ImportDictionaryChunkT,
  ImportDictionaryReqT,
  SearchDetailedReqT,
  SearchDetailedResT,
  SearchReqT,
  SearchResT,
} from 'server/types';
import { CheckWordResT } from 'server/types';
import { ErrorCodes } from 'server/core/constants/error_codes';

export class EnApi extends AbstractBaseApi {
  static async checkWord(word: string, pos: EnPartOfSpeechE, forPhrasal?: boolean): Promise<CheckWordResT> {
    return this.get<CheckWordResT>(`${this.baseURL}/en/check-word/${word}`, {
      query: { partOfSpeech: pos, forPhrasal },
    });
  }

  static async addWord(data: AddWordReqT): Promise<AddResT> {
    return this.post<AddResT>(`${this.baseURL}/en/add/word`, data);
  }

  static async search(search: string): Promise<SearchResT> {
    return this.searchByFilters({ search, limit: 100 });
  }

  // Mirrors the raw endpoint contract: every filter the DTO accepts is passed through as is
  static async searchByFilters(body: SearchReqT): Promise<SearchResT> {
    return this.post<SearchResT>(`${this.baseURL}/en/search`, body);
  }

  static async searchDetailed(body: SearchDetailedReqT): Promise<SearchDetailedResT> {
    return this.post<SearchDetailedResT>(`${this.baseURL}/en/search/detailed`, body);
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

  static async editPhrasalBase(body: EditPhrasalBaseReqT): Promise<EditPhrasalBaseResT> {
    return this.patch<EditPhrasalBaseResT>(`${this.baseURL}/en/phrasal-base`, body);
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
    return this.post<AddMeaningResT>(`${this.baseURL}/en/word/meaning`, body);
  }

  static async editMeaning(body: EditMeaningReqT): Promise<EditMeaningResT> {
    return this.patch<EditMeaningResT>(`${this.baseURL}/en/word/meaning`, body);
  }

  static async deleteMeaning(id: string | number): Promise<DeleteMeaningResT> {
    return this.delete<DeleteMeaningResT>(`${this.baseURL}/en/word/meaning/${id}`);
  }

  static async addMeaningTranslation(body: AddMeaningTranslationReqT): Promise<AddMeaningTranslationResT> {
    return this.post<AddMeaningTranslationResT>(`${this.baseURL}/en/word/meaning-translation`, body);
  }

  static async editMeaningTranslation(body: EditMeaningTranslationReqT): Promise<EditMeaningTranslationResT> {
    return this.patch<EditMeaningTranslationResT>(`${this.baseURL}/en/word/meaning-translation`, body);
  }

  static async deleteMeaningTranslation(id: string | number): Promise<DeleteMeaningTranslationResT> {
    return this.delete<DeleteMeaningTranslationResT>(`${this.baseURL}/en/word/meaning-translation/${id}`);
  }

  private static async readNdjsonStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    handleChunk: (ch: ImportDictionaryChunkT) => void,
    onError: (err: string) => void,
  ): Promise<{ success: boolean } | ErrorResT> {
    const decoder = new TextDecoder();
    let buffer = '';

    const parseLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const d: ImportDictionaryChunkT = JSON.parse(trimmed);
        handleChunk(d);
      } catch {
        onError(ErrorCodes.unparsed_data);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(parseLine);
      }

      parseLine(buffer);
    } catch {
      return { error: true, message: ErrorCodes.failed_fetch };
    }

    return { success: true };
  }

  static async getDatasetManifest(): Promise<GetDatasetManifestResT> {
    return this.get<GetDatasetManifestResT>(`${this.baseURL}/en/dictionary/manifest`);
  }

  static async importDictionary(
    handleChunk: (ch: ImportDictionaryChunkT) => void,
    onError: (err: string) => void,
  ): Promise<{ success: boolean } | ErrorResT> {
    // The dataset version comes back from the server (manifest.json), the
    // client no longer sends one
    const body: ImportDictionaryReqT = {};
    const reader = await AbstractBaseApi.stream(`${this.baseURL}/en/dictionary/import`, {
      method: 'POST',
      body: body as BodyInit,
    });

    if ('error' in reader) {
      return reader;
    }

    return this.readNdjsonStream(reader, handleChunk, onError);
  }

  static async exportDictionary(
    handleChunk: (ch: ImportDictionaryChunkT) => void,
    onError: (err: string) => void,
  ): Promise<{ success: boolean } | ErrorResT> {
    const reader = await AbstractBaseApi.stream(`${this.baseURL}/en/dictionary/export`);

    if ('error' in reader) {
      return reader;
    }

    return this.readNdjsonStream(reader, handleChunk, onError);
  }

  static async downloadExportedFile(
    exportId: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<DownloadedFileT | ErrorResT> {
    return this.downloadFile(`${this.baseURL}/en/dictionary/export/download/${exportId}`, {}, onProgress);
  }

  static async getStatistics(): Promise<GetEnStatisticsResT> {
    return this.get<EnStatisticsT>(`${this.baseURL}/en/statistics`);
  }

  static async getTranslationsStatistics(): Promise<GetEnTranslationsStatisticsResT> {
    return this.get<EnTranslationsStatisticsT>(`${this.baseURL}/en/statistics/translations`);
  }

  static async getIssuesStatistics(): Promise<GetEnIssuesStatisticsResT> {
    return this.get<EnIssuesStatisticsT>(`${this.baseURL}/en/statistics/issues`);
  }
}
