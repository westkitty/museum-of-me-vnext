#!/bin/bash
# Alternating matched trials of the governing walk sequence: before (4182) vs candidate (4180).
set -u
cd "/Users/andrew/museum of me/worktrees/wt-world-production-20261126"
OUT=perf-results/v5-ab-exp1-batch.txt; : > "$OUT"
for i in 1 2 3 4 5; do for v in before:4182 exp1:4180; do n=${v%%:*}; port=${v##*:}
  L=$(uptime | sed 's/.*averages: //' | cut -d' ' -f1)
  node scripts/perf-trace-walk.mjs http://127.0.0.1:$port/ perf-results/v5-abx-$n-$i --no-trace > /tmp/abx.$$ 2>&1
  node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(process.argv[2],"load",process.argv[3],"idleO20",r.idle.over20,"walkP99",r.walk.p99.toFixed(1),"walkO20",r.walk.over20,"int",r.slow.filter(x=>x.phase==="PREPARING_INTERIOR").length,"ren",r.slow.filter(x=>x.phase==="PREPARING_RENDER_RESOURCES").length,"other",r.slow.filter(x=>!x.phase.startsWith("PREPARING")).length)' perf-results/v5-abx-$n-$i/walk.json "$n-$i" "$L" >> "$OUT"
done; done
echo DONE >> "$OUT"
