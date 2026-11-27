/* eslint-disable -- one-off trace-analysis diagnostic, not shipped */
// Diagnostic: for each missed frame interval in a walk trace, list main/GPU thread work.
const fs=require('fs'),zlib=require('zlib');const raw=zlib.gunzipSync(fs.readFileSync(process.argv[2]));const t=JSON.parse(raw);const ev=t.traceEvents||t;
const names={};for(const e of ev){if(e.name==='thread_name')names[e.pid+':'+e.tid]=e.args.name;}
const key=(e)=>e.pid+':'+e.tid; const find=(n)=>Object.keys(names).filter(k=>names[k]===n);
const main=find('CrRendererMain')[0], gpu=find('CrGpuMain')[0], viz=find('VizCompositorThread')[0];
const marks=ev.filter(e=>/^f\d+:/.test(e.name)&&e.ph!=='X').sort((a,b)=>a.ts-b.ts);
const uniq=[];for(const m of marks){if(!uniq.length||uniq.at(-1).name!==m.name)uniq.push(m);} 
const X=ev.filter(e=>e.ph==='X');
const top=(k)=>X.filter(e=>key(e)===k&&(e.name==='RunTask'||e.name==='ThreadControllerImpl::RunTask'));
const mainT=top(main), gpuT=X.filter(e=>key(e)===gpu), vizT=top(viz);
for(let i=1;i<uniq.length;i++){const [_,dt,ph]=uniq[i].name.split(':');if(+dt<20)continue;const a=uniq[i-1].ts,b=uniq[i].ts;
 const m=mainT.filter(e=>e.ts<b&&e.ts+e.dur>a&&e.dur>1500).map(e=>{const kids=X.filter(c=>key(c)===main&&c.ts>=e.ts&&c.ts<e.ts+e.dur&&c.dur>1000&&/FunctionCall|TimerFire|FireAnimationFrame|GC|Paint|UpdateLayer|Layout|HitTest|ParseHTML|EvaluateScript|v8\.compile|Commit/.test(c.name)).sort((x,y)=>y.dur-x.dur).slice(0,2).map(c=>c.name.replace('FireAnimationFrame','rAF')+(c.dur/1000).toFixed(0));return `${((e.ts-a)/1000).toFixed(0)}+${(e.dur/1000).toFixed(0)}[${kids.join(',')}]`;});
 const gTop=gpuT.filter(e=>e.ts<b&&e.ts+e.dur>a&&(e.name==='RunTask'||e.name==='ThreadControllerImpl::RunTask'));const gBusy=gTop.reduce((s,e)=>s+e.dur,0)/1000;
 const gLong=gpuT.filter(e=>e.ts<b&&e.ts+e.dur>a&&e.dur>4000&&!/RunTask|Scheduler/.test(e.name)).sort((x,y)=>y.dur-x.dur).slice(0,3).map(e=>e.name.slice(0,40)+(e.dur/1000).toFixed(0));
 console.log(`f${i} dt${(+dt).toFixed(0)} ${ph.slice(10,14)} span${((b-a)/1000).toFixed(0)} main:${m.join(' ')} | gpuBusy ${gBusy.toFixed(0)} ${gLong.join(',')}`);}
