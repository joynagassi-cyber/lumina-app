/**
 * Workflow Engine — interprets declarative state machines declared in the Org
 * Manifest (WorkflowDefinition). The finance approval flow is NOT hardcoded:
 * draft → pending → approved/rejected (with re-submit) is data, per ADR-001
 * (Workflow Engine — hybrid) and INV-005 (manifest > hardcoded code).
 */
import type { OrgManifest, WorkflowDefinition, WorkflowNodeDef } from '../manifest/types';

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export interface TransitionResult {
  from: string;
  to: string;
  allowed: boolean;
  reason?: string;
}

export class WorkflowEngine {
  private readonly workflows: Map<string, WorkflowDefinition>;

  constructor(manifest: OrgManifest) {
    this.workflows = new Map(manifest.workflows.map((w) => [w.id, w]));
  }

  static fromManifest(manifest: OrgManifest): WorkflowEngine {
    return new WorkflowEngine(manifest);
  }

  hasWorkflow(id: string): boolean {
    return this.workflows.has(id);
  }

  workflowIds(): string[] {
    return [...this.workflows.keys()];
  }

  getWorkflow(id: string): WorkflowDefinition {
    const wf = this.workflows.get(id);
    if (!wf) throw new WorkflowError(`Workflow inconnu: "${id}"`);
    return wf;
  }

  private node(wfId: string, state: string): WorkflowNodeDef {
    const node = this.getWorkflow(wfId).nodes.find((n) => n.id === state);
    if (!node) throw new WorkflowError(`État "${state}" absent du workflow "${wfId}"`);
    return node;
  }

  /** Valid next states for a given state (from the node's transitions). */
  transitionsFrom(wfId: string, state: string): string[] {
    return [...this.node(wfId, state).transitions];
  }

  canTransition(wfId: string, from: string, to: string): boolean {
    return this.node(wfId, from).transitions.includes(to);
  }

  /**
   * Attempt a transition. Returns a structured verdict — does NOT throw for a
   * denied transition (the caller decides the UX); throws only for an unknown
   * workflow or unknown state (configuration problem).
   */
  transition(wfId: string, from: string, to: string): TransitionResult {
    const node = this.node(wfId, from);
    if (node.transitions.includes(to)) {
      return { from, to, allowed: true };
    }
    return {
      from,
      to,
      allowed: false,
      reason: `Transition "${from}" → "${to}" interdite (autorisees: ${node.transitions.join(', ') || 'aucune'})`,
    };
  }

  /** Does a path exist from → to in the state graph (BFS)? */
  pathExists(wfId: string, from: string, to: string): boolean {
    const def = this.getWorkflow(wfId);
    const adj = new Map(def.nodes.map((n) => [n.id, n.transitions]));
    const seen = new Set<string>([from]);
    const queue = [from];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;
      for (const next of adj.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  }

  isEndState(wfId: string, state: string): boolean {
    const node = this.node(wfId, state);
    return node.type === 'end' && node.transitions.length === 0;
  }

  isApprovalState(wfId: string, state: string): boolean {
    return this.node(wfId, state).type === 'approval';
  }

  startState(wfId: string): string {
    const start = this.getWorkflow(wfId).nodes.find((n) => n.type === 'start');
    if (!start) throw new WorkflowError(`Workflow "${wfId}" sans état de départ`);
    return start.id;
  }

  /** States that end a flow (type end, no outgoing transitions). */
  endStates(wfId: string): string[] {
    return this.getWorkflow(wfId).nodes.filter((n) => this.isEndState(wfId, n.id)).map((n) => n.id);
  }

  /**
   * Static validation of a workflow definition: unique start, every transition
   * target exists, no self-loop on end states. Throws WorkflowError listing the
   * first problem found (fail fast, NB-RULE-05 spirit).
   */
  validateDefinition(wf: WorkflowDefinition): void {
    const ids = new Set(wf.nodes.map((n) => n.id));
    const starts = wf.nodes.filter((n) => n.type === 'start');
    if (starts.length !== 1) {
      throw new WorkflowError(`Workflow "${wf.id}" doit avoir exactement 1 état start (trouvé: ${starts.length})`);
    }
    for (const node of wf.nodes) {
      for (const target of node.transitions) {
        if (!ids.has(target)) {
          throw new WorkflowError(`Workflow "${wf.id}": transition "${node.id}" → "${target}" vers un état inconnu`);
        }
      }
      if (node.type === 'end' && node.transitions.length > 0) {
        throw new WorkflowError(`Workflow "${wf.id}": l'état final "${node.id}" ne doit pas avoir de transitions`);
      }
    }
  }
}
