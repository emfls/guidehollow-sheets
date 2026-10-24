/** Only permit final confirmation when every difference page was opened or the
 * visitor requested a full local review report. The checkboxes still require
 * their own explicit human review and approval. */
export function conflictReviewReady(totalConflicts: number, pageSize: number, visited: ReadonlySet<number>, reportRequested: boolean): boolean {
  if (totalConflicts <= 0) return true;
  if (!Number.isInteger(pageSize) || pageSize <= 0) return false;
  if (reportRequested) return true;
  const count = Math.ceil(totalConflicts / pageSize);
  for (let i = 0; i < count; i++) if (!visited.has(i)) return false;
  return true;
}
