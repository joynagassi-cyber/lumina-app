/**
 * Workflow Domain — skeleton per ITS-V1
 */

export interface IWorkflowPort {
  findById(id: string): Promise<unknown>;
  executeWorkflow(data: unknown): Promise<unknown>;
}

export class WorkflowModule {}
