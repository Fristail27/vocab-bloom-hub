import type {
  ReconciliationPreparationStageT,
  ReconciliationApplicationStageT,
} from '../../../../../types/reconciliation';

export type ReconciliationCounterT = (processed: number, total?: number) => void;
export type ReconciliationProgressSinkT = (
  stage: ReconciliationPreparationStageT,
  processed: number,
  total?: number,
) => void;

export function preparationStage(
  sink: ReconciliationProgressSinkT | undefined,
  stage: ReconciliationPreparationStageT,
): ReconciliationCounterT | undefined {
  sink?.(stage, 0);
  return sink ? (processed, total) => sink(stage, processed, total) : undefined;
}

export type ReconciliationApplicationSinkT = (
  stage: ReconciliationApplicationStageT,
  processed: number,
  total?: number,
) => void;

export function applicationStage(
  sink: ReconciliationApplicationSinkT | undefined,
  stage: ReconciliationApplicationStageT,
): ReconciliationCounterT | undefined {
  sink?.(stage, 0);
  return sink ? (processed, total) => sink(stage, processed, total) : undefined;
}
