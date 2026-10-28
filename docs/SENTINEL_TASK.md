# Drift Sentinel 2.0 - Operations Task Definition

## Scheduling Boundary

**WARNING: Do not enable automated scheduling without explicit owner approval.**

If Jules or another CI runner cannot enforce read-only scheduled execution, do not activate that schedule. Automated changes, such as automatic source repairs, branch merges, deployments, or rewriting historical records, are strictly prohibited for Drift Sentinel runs.

## Manual Inspection Cycle

Before any scheduled task is considered, the manual inspection cycle must be proven:

1. **Run the core inspection (read-only):**
   ```bash
   node scripts/sentinel/runner.js
   ```
2. **Generate the interactive report (offline-readable):**
   ```bash
   node scripts/sentinel/report.js
   ```
3. **Open `public/sentinel/index.html` in a web browser** to view the timeline, evidence links, unknown variables, and the recommended bounding tasks.
4. **Take Corrective Action**: Apply suggested bounds manually (e.g., converting recurring issues to fixtures or implementing targeted fixes for new drift). Sentinel will not do this automatically.

## Weekly Jules Task Definition (Pending Approval)

*Only valid if owner approval for read-only scheduling has been granted.*

**Trigger:** Weekly (e.g., Friday 00:00 UTC)
**Context Limit:** Read-only access to repository root `westkitty/museum-of-me-vnext`.

**Task Execution Steps:**
1. Execute `node scripts/sentinel/runner.js`
2. Execute `node scripts/sentinel/report.js`
3. Export or attach `public/sentinel/index.html` as the inspection artifact.
4. Do not push commits. Do not resolve errors on behalf of the project. Do not modify source code or asset files.
