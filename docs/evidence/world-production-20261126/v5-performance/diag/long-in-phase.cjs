/* eslint-disable -- one-off trace-analysis diagnostic, not shipped */
// Diagnostic: main-thread tasks over a threshold inside one app phase, with their largest children.
const fs=require('fs'),zlib=require('zlib');const t=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));const ev=t.traceEvents||t;const PH=process.argv[3]||'PREPARING_INTERIOR';const TH=+(process.argv[4]||12)*1000;
const names={};for(const e of ev){if(e.name==='thread_name')names[e.pid+':'+e.tid]=e.args.name;}
const main=Object.keys(names).find(k=>names[k]==='CrRendererMain');const k=e=>e.pid+':'+e.tid;
const marks=ev.filter(e=>/^f\d+:/.test(e.name)&&e.ph!=='X').sort((a,b)=>a.ts-b.ts).filter(m=>m.name.endsWith(':'+PH));const a=marks[0].ts-50000,b=marks.at(-1).ts;
const X=ev.filter(e=>e.ph==='X'&&k(e)===main);
const tasks=X.filter(e=>(e.name==='ThreadControllerImpl::RunTask'||e.name==='RunTask')&&e.ts>=a&&e.ts<=b&&e.dur>TH);
const seen=new Set();for(const T of tasks.sort((x,y)=>x.ts-y.ts)){if(seen.has(T.ts))continue;seen.add(T.ts);
 const kids=X.filter(c=>c.ts>=T.ts&&c.ts<T.ts+T.dur&&c!==T&&!/RunTask/.test(c.name)&&c.dur>1500).sort((x,y)=>y.dur-x.dur).slice(0,5).map(c=>`${c.name}${c.args?.data?.functionName?'('+c.args.data.functionName+')':''}${c.args?.data?.url?'@'+c.args.data.url.split('/').pop():''} ${(c.dur/1000).toFixed(1)}`);
 console.log(((T.ts-a)/1000).toFixed(0).padStart(5),'dur',(T.dur/1000).toFixed(1).padStart(5),'|',kids.join(' ; '));}
