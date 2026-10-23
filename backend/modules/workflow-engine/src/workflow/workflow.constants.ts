export const WORKFLOW_QUEUE = 'workflow-steps';

export interface WorkflowJobData {
  runId: string;
  stepId: string;
  /** Set when this job is itself running as a compensation step. */
  compensating?: boolean;
}
