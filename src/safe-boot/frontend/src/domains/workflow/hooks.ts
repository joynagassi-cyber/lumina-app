/**
 * Workflow Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 5 (WorkflowAggregate)
 * @traceability ASS-001: Application Services for workflow operations
 */

import { useMemo } from 'react';
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
} from './types';
import {
  useListWorkflowDefinitionsQuery,
  useListWorkflowInstancesQuery,
  useGetWorkflowInstanceQuery,
  useListWorkflowInstanceStepsQuery,
  useCompleteStepMutation,
  useSkipStepMutation,
  useRetryFailedStepMutation,
  useAssignStepMutation,
} from './api';

/* ------------------------------------------------------------------ */
/*  useWorkflows                                                       */
/* ------------------------------------------------------------------ */

/**
 * Returns workflow instances and definitions for an organization.
 */
export function useWorkflows(organizationId: string | null) {
  const { data: definitions, isLoading: loadingDefinitions } = useListWorkflowDefinitionsQuery(
    organizationId ?? '',
    { skip: !organizationId }
  );

  const { data: instancesResponse, isLoading: loadingInstances, error: instancesError } =
    useListWorkflowInstancesQuery(
      { organizationId: organizationId ?? '' },
      { skip: !organizationId }
    );

  const instances = instancesResponse?.items as WorkflowInstance[] | [];
  const totalCount = instancesResponse?.totalCount || 0;

  const definitionsList = definitions as WorkflowDefinition[] | [];

  return useMemo(() => ({
    definitions: definitionsList,
    instances,
    totalCount,
    selectedInstance: null,
    steps: [],
    isLoading: loadingDefinitions || loadingInstances,
    error: instancesError,
    loading: loadingDefinitions || loadingInstances,
  }), [definitionsList, instances, totalCount, loadingDefinitions, loadingInstances, instancesError]);
}

/* ------------------------------------------------------------------ */
/*  useWorkflowInstance                                                */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific workflow instance with its steps.
 */
export function useWorkflowInstance(organizationId: string | null, instanceId: string | null) {
  const { data: instance, isLoading: loadingInstance, error: instanceError } = useGetWorkflowInstanceQuery(
    instanceId ?? '',
    { skip: !instanceId || !organizationId }
  );

  const { data: steps, isLoading: loadingSteps, error: stepsError } = useListWorkflowInstanceStepsQuery(
    instanceId ?? '',
    { skip: !instanceId || !organizationId }
  );

  const workflowInstance = instance as WorkflowInstance | undefined;
  const workflowSteps = steps as WorkflowStep[] | [];

  return useMemo(() => ({
    instance: workflowInstance ?? null,
    steps: workflowSteps,
    isLoading: loadingInstance || loadingSteps,
    error: instanceError || stepsError,
    loading: loadingInstance || loadingSteps,
  }), [workflowInstance, workflowSteps, loadingInstance, loadingSteps, instanceError, stepsError]);
}

/* ------------------------------------------------------------------ */
/*  useStepActions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Provides step completion/assignment actions for workflow steps.
 */
export function useStepActions(instanceId: string | null) {
  const [completeStep, { isLoading: isLoadingComplete }] = useCompleteStepMutation();
  const [skipStep, { isLoading: isLoadingSkip }] = useSkipStepMutation();
  const [retryFailedStep, { isLoading: isLoadingRetry }] = useRetryFailedStepMutation();
  const [assignStep, { isLoading: isLoadingAssign }] = useAssignStepMutation();

  const executeAction = (stepId: string, action: 'complete' | 'skip' | 'retry' | 'assign', userId?: string) => {
    if (!instanceId) return;
    if (action === 'complete') completeStep(stepId);
    if (action === 'skip') skipStep(stepId);
    if (action === 'retry') retryFailedStep(stepId);
    if (action === 'assign' && userId) assignStep({ stepId, userId });
  };

  return useMemo(() => ({
    completeStep: (stepId: string) => executeAction(stepId, 'complete'),
    skipStep: (stepId: string) => executeAction(stepId, 'skip'),
    retryFailedStep: (stepId: string) => executeAction(stepId, 'retry'),
    assignStep: (stepId: string, userId: string) => executeAction(stepId, 'assign', userId),
    isLoading: isLoadingComplete || isLoadingSkip || isLoadingRetry || isLoadingAssign,
  }), [instanceId, completeStep, skipStep, retryFailedStep, assignStep]);
}