# Promotion checklist: `main` → `pages-preview` (GitHub Pages)

A short operational form of `RELEASE_RUNBOOK.md` ("Publication and 1.0 boundary"). The runbook governs; this list is the order of commands. Promotion publishes to https://westkitty.github.io/museum-of-me-vnext/, so it needs the owner's explicit approval of the exact SHA.

## Before

1. Run `npm run status`. Confirm:
   - the latest CI on `main` is `success` on the SHA you mean to publish (all four jobs: `gate`, `browser`, `workshop`, `standalone`);
   - `pages-preview` is an ancestor of `main` (a fast-forward, no divergent publication commits).
2. Inspect what will be exposed: `git log --oneline origin/pages-preview..origin/main` and `git diff --stat origin/pages-preview origin/main`.
3. Human QA (runbook step 2): record the real-device pass and run `npm run verify:human-evidence -- <record.md>`. If the owner publishes without it, write that down in the promotion record. Automated checks do not replace it.
4. Obtain explicit owner approval naming the target (`pages-preview`) and the exact SHA.

## Promote

5. Fast-forward only. Never force:

   ```bash
   git fetch origin
   git push origin <approved-sha>:refs/heads/pages-preview
   ```

   A rejected push means `pages-preview` has diverged. Stop and reconcile; do not force.

## After

6. Watch the `deploy-pages.yml` run for that SHA through to `verify-pages-hosted`:

   ```bash
   gh run list --workflow deploy-pages.yml --branch pages-preview --limit 1
   gh run watch <run-id> --exit-status
   ```

7. Confirm the live receipt: `curl -s https://westkitty.github.io/museum-of-me-vnext/build-info.json` must report the approved `sha`.
8. Open the hosted site in a browser: exterior loads, walk in through the doorway, no console errors. Pointer lock and audio need a human on a real device.
9. Run `npm run status` again, commit the refreshed `docs/STATUS.md`, and add a Bible entry recording the SHA, run IDs and anything not verified.

If any hosted check fails, fix forward through a new PR to `main` and promote again. Do not claim publication success.
