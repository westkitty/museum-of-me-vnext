/* eslint-disable -- one-off trace-analysis diagnostic, not shipped */
// Diagnostic: GPU main thread self-time by event name within phase windows of a walk trace.
const fs=require('fs'),zlib=require('zlib');const t=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])));const ev=t.traceEvents||t;
const names={};for(const e of ev){if(e.name==='thread_name')names[e.pid+':'+e.tid]=e.args.name;}
const gpu=Object.keys(names).find(k=>names[k]==='CrGpuMain');
const marks=ev.filter(e=>/^f\d+:/.test(e.name)&&e.ph!=='X').sort((a,b)=>a.ts-b.ts);
const phaseAt=(ts)=>{let p='pre';for(const m of marks){if(m.ts>ts)break;p=m.name.split(':')[2];}return p;};
const G=ev.filter(e=>e.ph==='X'&&(e.pid+':'+e.tid)===gpu).sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
// self time: subtract direct children
const self=new Map();const stack=[];
for(const e of G){while(stack.length&&stack.at(-1).ts+stack.at(-1).dur<=e.ts)stack.pop();if(stack.length){const p=stack.at(-1);self.set(p,(self.get(p)??p.dur)-e.dur);}self.set(e,self.get(e)??e.dur);stack.push(e);}
const agg={};for(const [e,s] of self){const ph=phaseAt(e.ts);agg[ph]=agg[ph]||{};agg[ph][e.name]=(agg[ph][e.name]||0)+s;}
for(const [ph,m] of Object.entries(agg)){const tot=Object.values(m).reduce((a,b)=>a+b,0);console.log(ph,'total self ms',(tot/1000).toFixed(0));for(const [n,v] of Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12))console.log('   ',(v/1000).toFixed(1),n);}
