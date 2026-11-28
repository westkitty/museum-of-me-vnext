/* eslint-disable -- one-off trace-analysis diagnostic, not shipped */
// Diagnostic: renderer main-thread busy fraction and task-length distribution per app phase in a walk trace.
const fs=require('fs'),zlib=require('zlib');const t=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));const ev=t.traceEvents||t;
const names={};for(const e of ev){if(e.name==='thread_name')names[e.pid+':'+e.tid]=e.args.name;}
const main=Object.keys(names).find(k=>names[k]==='CrRendererMain');
const marks=ev.filter(e=>/^f\d+:/.test(e.name)&&e.ph!=='X').sort((a,b)=>a.ts-b.ts);
const win={};for(const m of marks){const ph=m.name.split(':')[2];(win[ph]||=[m.ts,m.ts])[1]=m.ts;}
const tasks=ev.filter(e=>e.ph==='X'&&(e.name==='RunTask'||e.name==='ThreadControllerImpl::RunTask')&&(e.pid+':'+e.tid)===main);
// merge overlapping (nested RunTask duplicates)
const iv=tasks.map(e=>[e.ts,e.ts+e.dur]).sort((a,b)=>a[0]-b[0]);const merged=[];for(const x of iv){if(merged.length&&x[0]<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(merged.at(-1)[1],x[1]);else merged.push([...x]);}
for(const [ph,[a,b]] of Object.entries(win)){let busy=0;const lens=[];for(const [s,e] of merged){const o=Math.min(e,b)-Math.max(s,a);if(o>0){busy+=o;lens.push((e-s)/1000);}}
 lens.sort((x,y)=>x-y);console.log(ph.padEnd(28),'window ms',((b-a)/1000).toFixed(0),'busy',(100*busy/(b-a)).toFixed(0)+'%','tasks',lens.length,'>8ms',lens.filter(x=>x>8).length,'>12ms',lens.filter(x=>x>12).length,'max',lens.at(-1)?.toFixed(1));}
