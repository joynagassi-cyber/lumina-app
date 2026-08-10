/**
 * Workflow Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 5 (WorkflowAggregate)
 * @traceability ASS-001: Application Services for workflow operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: workflows, workflow_instances, workflow_steps tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CreateWorkflowDefinitionInput,
  CreateWorkflowInstanceInput,
  ListWorkflowInstancesInput,
  PaginatedResponse,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchWorkflows<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Workflow API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const workflowApi = createApi({
  reducerPath: 'workflowApi',
  baseQuery: async ({
    endpoint,
    method,
    body,
  }: {
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  }) => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: method ?? 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `API ${response.status}: ${errorBody || response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['WorkflowDefinition', 'WorkflowInstance', 'WorkflowStep'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listWorkflowDefinitions: builder.query<ReadonlyArray<WorkflowDefinition>, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/workflows/definitions`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'WorkflowDefinition', id: orgId }],
    }),

    getWorkflowDefinition: builder.query<WorkflowDefinition, string>({
      query: (definitionId) => ({ endpoint: `/definitions/${definitionId}`, method: 'GET' }),
      providesTags: (_result, _err, definitionId) => [{ type: 'WorkflowDefinition', id: definitionId }],
    }),

    listWorkflowInstances: builder.query<PaginatedResponse<WorkflowInstance>, ListWorkflowInstancesInput>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.workflowDefinitionId) params.append('workflowDefinitionId', args.workflowDefinitionId);
        if (args.contextType) params.append('contextType', args.contextType);
        if (args.state) params.append('state', args.state);
        if (args.page) params.append('page', args.page.toString());
        if (args.limit) params.append('limit', args.limit.toString());
        return {
          endpoint: `/instances/${args.organizationId}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (_result, _err, arg) => [{ type: 'WorkflowInstance', id: arg.organizationId }],
    }),

    getWorkflowInstance: builder.query<WorkflowInstance, string>({
      query: (instanceId) => ({ endpoint: `/instances/${instanceId}`, method: 'GET' }),
      providesTags: (_result, _err, instanceId) => [{ type: 'WorkflowInstance', id: instanceId }],
    }),

    listWorkflowInstanceSteps: builder.query<ReadonlyArray<WorkflowStep>, string>({
      query: (instanceId) => ({ endpoint: `/instances/${instanceId}/steps`, method: 'GET' }),
      providesTags: (_result, _err, instanceId) => [{ type: 'WorkflowStep', id: instanceId }],
    }),

    /* ---- Mutations ---- */

    createWorkflowDefinition: builder.mutation<WorkflowDefinition, CreateWorkflowDefinitionInput>({
      query: (body) => ({ endpoint: '/workflows/definitions', method: 'POST', body }),
      invalidatesTags: [{ type: 'WorkflowDefinition', id: 'LIST' }],
    }),

    updateWorkflowDefinition: builder.mutation<WorkflowDefinition, UpdateWorkflowDefinitionInput>({
      query: ({ workflowDefinitionId, ...body }) => ({
        endpoint: `/definitions/${workflowDefinitionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'WorkflowDefinition', id: arg.workflowDefinitionId }],
    }),

    activateWorkflowDefinition: builder.mutation<WorkflowDefinition, string>({
      query: (definitionId) => ({
        endpoint: `/definitions/${definitionId}/activate`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, definitionId) => [{ type: 'WorkflowDefinition', id: definitionId }],
    }),

    archiveWorkflowDefinition: builder.mutation<WorkflowDefinition, string>({
      query: (definitionId) => ({
        endpoint: `/definitions/${definitionId}/archive`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'WorkflowDefinition', id: 'LIST' }],
    }),

    createWorkflowInstance: builder.mutation<WorkflowInstance, CreateWorkflowInstanceInput>({
      query: (body) => ({ endpoint: '/workflows/instances', method: 'POST', body }),
      invalidatesTags: [{ type: 'WorkflowInstance', id: 'LIST' }],
    }),

    completeWorkflowInstance: builder.mutation<WorkflowInstance, string>({
      query: (instanceId) => ({
        endpoint: `/instances/${instanceId}/complete`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, instanceId) => [{ type: 'WorkflowInstance', id: instanceId }],
    }),

    cancelWorkflowInstance: builder.mutation<WorkflowInstance, string>({
      query: (instanceId) => ({
        endpoint: `/instances/${instanceId}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'WorkflowInstance', id: 'LIST' }],
    }),

    /* ---- Step Actions ---- */

    completeStep: builder.mutation<WorkflowStep, string>({
      query: (stepId) => ({ endpoint: `/steps/${stepId}/complete`, method: 'POST' }),
      invalidatesTags: (_result, _err, stepId) => {
        // Infer instance ID from step ID (simplified)
        const instanceId = stepId.split('-').slice(0, -1).join('-');
        return [{ type: 'WorkflowStep', id: instanceId }];
      }
    }),

    skipStep: builder.mutation<WorkflowStep, string>({
      query: (stepId) => ({ endpoint: `/steps/${stepId}/skip`, method: 'POST' }),
      invalidatesTags: (_result, _err, stepId) => {
        const instanceId = stepId.split('-').slice(0, -1).join('-');
        return [{ type: 'WorkflowStep', id: instanceId }];
      }
    }),

    retryFailedStep: builder.mutation<WorkflowStep, string>({
      query: (stepId) => ({ endpoint: `/steps/${stepId}/retry`, method: 'POST' }),
      invalidatesTags: (_result, _err, stepId) => {
        const instanceId = stepId.split('-').slice(0, -1).join('-');
        return [{ type: 'WorkflowStep', id: instanceId }];
      }
    }),

    assignStep: builder.mutation<WorkflowStep, { stepId: string; userId: string }>({
      query: ({ stepId, userId }) => ({
        endpoint: `/steps/${stepId}/assign`,
        method: 'POST',
        body: { userId },
      }),
      invalidatesTags: (_result, _err, arg) => {
        const instanceId = arg.stepId.split('-').slice(0, -1).join('-');
        return [{ type: 'WorkflowStep', id: instanceId }];
      }
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListWorkflowDefinitionsQuery,
  useGetWorkflowDefinitionQuery,
  useListWorkflowInstancesQuery,
  useGetWorkflowInstanceQuery,
  useListWorkflowInstanceStepsQuery,
  useCreateWorkflowDefinitionMutation,
  useUpdateWorkflowDefinitionMutation,
  useActivateWorkflowDefinitionMutation,
  useArchiveWorkflowDefinitionMutation,
  useCreateWorkflowInstanceMutation,
  useCompleteWorkflowInstanceMutation,
  useCancelWorkflowInstanceMutation,
  useCompleteStepMutation,
  useSkipStepMutation,
  useRetryFailedStepMutation,
  useAssignStepMutation,
} = workflowApi;

export default workflowApi;