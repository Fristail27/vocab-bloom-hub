import { AbstractBaseApi } from '../AbstractBaseApi';
import type {
  ReconciliationCategoryT,
  ReconciliationDecisionT,
  ReconciliationIndexT,
  ReconciliationItemT,
  ReconciliationSummaryT,
} from 'server/types/reconciliation';
import type { ReconciliationSideT } from 'server/types/reconciliation';

export class ReconciliationApi extends AbstractBaseApi {
  private static url(dataset: string, suffix = '') {
    return `${this.baseURL}/en/datasets/${encodeURIComponent(dataset)}/reconciliation${suffix}`;
  }
  static list(dataset: string, headword?: string) {
    return this.request<ReconciliationIndexT>(this.url(dataset), { query: { search: headword } });
  }
  static summary(dataset: string, id: string) {
    return this.request<ReconciliationSummaryT>(this.url(dataset, `/${id}`));
  }
  static items(dataset: string, id: string, page: number, category?: ReconciliationCategoryT, search?: string) {
    return this.request<{ items: ReconciliationItemT[]; total: number }>(this.url(dataset, `/${id}/items`), {
      query: { page, category, search },
    });
  }
  static prepare(dataset: string, source: string, allowTwoWay = false) {
    return this.post<ReconciliationSummaryT>(this.url(dataset, '/parent'), {
      source,
      allow_two_way: allowTwoWay,
    });
  }
  static decide(
    dataset: string,
    id: string,
    headword: string,
    version: number,
    decisions: ReconciliationDecisionT[],
  ) {
    return this.post<ReconciliationItemT>(this.url(dataset, `/${id}/decisions`), {
      headword,
      version,
      decisions,
    });
  }
  static apply(dataset: string, id: string) {
    return this.request<ReconciliationSummaryT>(this.url(dataset, `/${id}/apply`), { method: 'POST' });
  }
  static override(dataset: string, id: string, headword: string, version: number, result: ReconciliationSideT) {
    return this.post<ReconciliationItemT>(this.url(dataset, `/${id}/result`), { headword, version, result });
  }
  static cancel(dataset: string, id: string) {
    return this.request<{ success: boolean }>(this.url(dataset, `/${id}/cancel`), { method: 'POST' });
  }
}
