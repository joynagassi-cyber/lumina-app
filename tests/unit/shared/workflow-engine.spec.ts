import { ManifestEngine } from '../../../src/shared/manifest';
import mfeJcManifest from '../../../src/shared/manifest/manifests/mfe-jc.json';
import { WorkflowEngine, WorkflowError } from '../../../src/shared/workflow';

const TRANSACTION_WF = 'transaction_state_machine';

describe('WorkflowEngine', () => {
  const manifest = new ManifestEngine().compile(mfeJcManifest);
  const engine = WorkflowEngine.fromManifest(manifest);

  it('expose le workflow transaction déclaré dans le manifest', () => {
    expect(engine.hasWorkflow(TRANSACTION_WF)).toBe(true);
    expect(engine.workflowIds()).toContain(TRANSACTION_WF);
    const wf = engine.getWorkflow(TRANSACTION_WF);
    expect(wf.name).toBe('Cycle de vie transaction');
    expect(wf.version).toBe('1.0.0');
  });

  describe('machine à états finance (déclarative, non codée en dur)', () => {
    it('draft → pending (soumission)', () => {
      expect(engine.transitionsFrom(TRANSACTION_WF, 'draft')).toEqual(['pending']);
      expect(engine.canTransition(TRANSACTION_WF, 'draft', 'pending')).toBe(true);
    });

    it('pending → approved | rejected (approbation)', () => {
      expect(engine.transitionsFrom(TRANSACTION_WF, 'pending')).toEqual(['approved', 'rejected']);
    });

    it('rejected → draft (re-soumission)', () => {
      expect(engine.canTransition(TRANSACTION_WF, 'rejected', 'draft')).toBe(true);
    });

    it('approved est terminal — aucune transition', () => {
      expect(engine.transitionsFrom(TRANSACTION_WF, 'approved')).toEqual([]);
      expect(engine.isEndState(TRANSACTION_WF, 'approved')).toBe(true);
      expect(engine.isEndState(TRANSACTION_WF, 'draft')).toBe(false);
      expect(engine.isEndState(TRANSACTION_WF, 'rejected')).toBe(false); // re-soumissible
    });

    it('pending est un état d\'approbation', () => {
      expect(engine.isApprovalState(TRANSACTION_WF, 'pending')).toBe(true);
      expect(engine.isApprovalState(TRANSACTION_WF, 'draft')).toBe(false);
    });

    it('départ = start, états finaux = approved seulement', () => {
      expect(engine.startState(TRANSACTION_WF)).toBe('start');
      expect(engine.endStates(TRANSACTION_WF)).toEqual(['approved']);
    });
  });

  describe('transition() — verdict structuré, sans throw pour un refus', () => {
    it('autorise une transition valide', () => {
      expect(engine.transition(TRANSACTION_WF, 'pending', 'approved')).toEqual({
        from: 'pending',
        to: 'approved',
        allowed: true,
      });
    });

    it('refuse une transition invalide avec la liste des autorisées', () => {
      const res = engine.transition(TRANSACTION_WF, 'draft', 'approved');
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Transition "draft" → "approved" interdite/);
      expect(res.reason).toContain('pending');
    });

    it('lève WorkflowError pour un état inconnu (problème de config)', () => {
      expect(() => engine.transition(TRANSACTION_WF, 'deleted', 'approved')).toThrow(WorkflowError);
      expect(() => engine.transition('workflow_inconnu', 'draft', 'pending')).toThrow(WorkflowError);
    });
  });

  describe('pathExists — accessibilité dans le graphe', () => {
    it('un chemin existe de draft à approved', () => {
      expect(engine.pathExists(TRANSACTION_WF, 'draft', 'approved')).toBe(true);
      expect(engine.pathExists(TRANSACTION_WF, 'draft', 'rejected')).toBe(true);
    });

    it('approved est terminal — aucun chemin sortant', () => {
      expect(engine.pathExists(TRANSACTION_WF, 'approved', 'draft')).toBe(false);
      expect(engine.pathExists(TRANSACTION_WF, 'approved', 'approved')).toBe(true);
    });

    it('rejected peut revenir à draft (boucle de re-soumission)', () => {
      expect(engine.pathExists(TRANSACTION_WF, 'rejected', 'draft')).toBe(true);
    });
  });

  describe('validateDefinition — intégrité des workflows déclarés', () => {
    it('le workflow transaction du manifest est valide', () => {
      expect(() => engine.validateDefinition(engine.getWorkflow(TRANSACTION_WF))).not.toThrow();
    });

    it('rejette un workflow sans état start unique', () => {
      expect(() =>
        engine.validateDefinition({
          id: 'broken',
          name: 'x',
          version: '1.0.0',
          nodes: [{ id: 'a', type: 'task', transitions: [] }],
        }),
      ).toThrow(/exactement 1 état start/);
    });

    it('rejette une transition vers un état inconnu', () => {
      expect(() =>
        engine.validateDefinition({
          id: 'broken',
          name: 'x',
          version: '1.0.0',
          nodes: [
            { id: 'start', type: 'start', transitions: ['ghost'] },
            { id: 'ghost2', type: 'task', transitions: [] },
          ],
        }),
      ).toThrow(/état inconnu/);
    });

    it('rejette un état final avec des transitions sortantes', () => {
      expect(() =>
        engine.validateDefinition({
          id: 'broken',
          name: 'x',
          version: '1.0.0',
          nodes: [
            { id: 'start', type: 'start', transitions: ['done'] },
            { id: 'done', type: 'end', transitions: ['start'] },
          ],
        }),
      ).toThrow(/état final .* ne doit pas avoir de transitions/);
    });
  });
});
