import { basename } from 'node:path';

/**
 * Where a test that once produced committed evidence writes its captures.
 *
 * Several suites were written to refresh a dated, committed evidence folder
 * under docs/evidence/ on every run. Ordinary test runs therefore rewrote
 * historical captures (V7 found 71 such files changed in the worktree). By
 * default captures now go to test-results/doc-evidence/<folder>; set
 * MUSEUM_REFRESH_DOC_EVIDENCE=1 to refresh the committed folder deliberately.
 */
export function historicalEvidenceFolder(docsFolder: string): string {
  return process.env.MUSEUM_REFRESH_DOC_EVIDENCE === '1'
    ? docsFolder
    : `test-results/doc-evidence/${basename(docsFolder)}`;
}
