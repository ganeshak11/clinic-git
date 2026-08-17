/**
 * Permission check for retraction — ADR 0003.
 * Only the original author or a supervisor may retract.
 *
 * CRITICAL: The final return is `false`, not `true`.
 * A trailing `return true` was the exact bug in codeexamples.md #5
 * that silently bypassed the entire permission model.
 */
export function canRetract(
  nodeAuthorId: string,
  requestingUserId: string,
  requestorIsSupervisor: boolean,
): boolean {
  return nodeAuthorId === requestingUserId || requestorIsSupervisor;
}
