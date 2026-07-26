/**
 * MemberState — state machine for member resources.
 * Transitions: active -> inactive | deceased | transferred
 *
 * @traceability DOC-012 Aggregate3 (MemberRecord states)
 */

export enum MemberState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DECEASED = 'deceased',
  TRANSFERRED = 'transferred',
}

export const MEMBER_STATE_TRANSITIONS: Record<MemberState, readonly MemberState[]> = {
  [MemberState.ACTIVE]: [MemberState.INACTIVE, MemberState.DECEASED, MemberState.TRANSFERRED],
  [MemberState.INACTIVE]: [MemberState.ACTIVE],
  [MemberState.DECEASED]: [],
  [MemberState.TRANSFERRED]: [],
};

export function canTransitionFrom(current: MemberState): readonly MemberState[] {
  return MEMBER_STATE_TRANSITIONS[current] ?? [];
}
