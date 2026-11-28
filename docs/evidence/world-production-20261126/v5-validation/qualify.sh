#!/bin/bash
# V5 cumulative qualification, strictly serial. Each step logs to this directory; a failure does not stop later steps.
cd "/Users/andrew/museum of me/worktrees/wt-world-production-20261126"
V=docs/evidence/world-production-20261126/v5-validation
export MUSEUM_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
pkill -f "vite preview --host 127.0.0.1 --port 4180" ; pkill -f "vite --host 127.0.0.1 --port 5181" ; sleep 2
step() { local name=$1; shift; local t0=$(date +%s); "$@" > "$V/$name.log" 2>&1; local rc=$?; echo "$name exit=$rc seconds=$(( $(date +%s) - t0 )) load=$(uptime | sed 's/.*averages: //')" >> "$V/SUMMARY.txt"; }
: > "$V/SUMMARY.txt"
step gate npm run gate
step dormant-dist-scan bash -c 'grep -l -E "createW0[1-9]World|createW10World|createL01World|productionWorlds|VITE_POCKET_REHEARSAL|TEST_ONLY_NOT_APPROVED_DEXTER" dist/assets/*.js; test -z "$(ls dist/assets | grep -E "w01-(bass|drums|other).*m4a")" && test -z "$(grep -l -E "createW0[1-9]World|createW10World|createL01World|productionWorlds" dist/assets/*.js)"'
step world-suite env MUSEUM_WORLDS_GL=metal npx playwright test -c playwright.worlds.config.ts
step standard-e2e env MUSEUM_WORLDS_GL=metal npm run test:e2e
step workshop npm run test:workshop
step standalone bash -c 'npm run build:standalone && npm run verify:standalone'
rm -f perf-results/device-results.json perf-results/transition-results.json
step perf-device env MUSEUM_PERF_HEADLESS=1 npm run perf:device
cp perf-results/device-results.json "$V/perf-device-results.json" 2>/dev/null; cp perf-results/transition-results.json "$V/perf-transition-results.json" 2>/dev/null
echo DONE >> "$V/SUMMARY.txt"
