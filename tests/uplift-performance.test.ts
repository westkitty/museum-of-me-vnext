import { it, expect } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { SourceVisitors } from '../src/world/SourceVisitors';
import { mergeStatic } from '../src/world/MergeStatic';
import { createExhibit } from '../src/exhibits/registry';
import { installExhibits } from '../src/exhibits';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';

it('reduces distant-body matrix submissions while preserving 60Hz near-conversation animation and route simulation', () => {
 const scope=new ResourceScope('cadence');
 const collisions=new CollisionWorld();
 collisions.addFloor(-500,500,-500,500,0);
 const interactions=new InteractionManager();
 const visitors=new SourceVisitors(scope,collisions,interactions,()=>{});
 const original=visitors.batch.setMatrixAt.bind(visitors.batch);
 let writes=0;
 visitors.batch.setMatrixAt=(id,matrix)=>{writes++;return original(id,matrix)};
 const initial=visitors.positions();
 for(let frame=0;frame<120;frame++) visitors.update(1/60,false,0,0);
 const final=visitors.positions();
 expect(visitors.count).toBe(17);
 expect(visitors.batch.instanceCount).toBe(327);
 expect(writes).toBeGreaterThan(0);
 // Personal-space bodies animate at 60Hz, middle-distance at 30Hz and
 // far-field at 10Hz while all route/collision steps continue at 60Hz.
 expect(writes).toBeLessThan(327*76);
 expect(final.some((v,index)=>Math.hypot(v.x-initial[index].x,v.z-initial[index].z)>0.1)).toBe(true);
 visitors.dispose();interactions.dispose();scope.dispose();
 expect(scope.size).toBe(0);
});

it('grounds all 17 animated authored visitors in one tracked contact-shadow draw', () => {
 const scope=new ResourceScope('contact-shadow-proof');
 const collisions=new CollisionWorld();
 collisions.addFloor(-500,500,-500,500,0);
 const interactions=new InteractionManager();
 const visitors=new SourceVisitors(scope,collisions,interactions,()=>{});
 const shadows=visitors.shadows;
 expect(shadows.name).toBe('authored-visitor-contact-shadows');
 expect(shadows.isInstancedMesh).toBe(true);
 expect(shadows.count).toBe(17);
 expect(shadows.frustumCulled).toBe(false);
 const material=shadows.material as THREE.MeshBasicMaterial;
 expect(material.alphaMap?.name).toBe('museum-shared-soft-radial-mask');
 expect(material.depthWrite).toBe(false);
 const mask=(material.alphaMap!.image as { data: Uint8Array }).data;
 expect(mask).toHaveLength(64*64*4);
 expect(mask[4*((32*64)+32)+1]).toBeGreaterThan(mask[1]);
 const before=new THREE.Matrix4();
 const after=new THREE.Matrix4();
 shadows.getMatrixAt(0,before);
 for(let frame=0;frame<120;frame++)visitors.update(1/60,false,0,0);
 shadows.getMatrixAt(0,after);
 // Shadows update from presentation cadence; they never drive collision/route.
 expect(Number.isFinite(after.elements[13])).toBe(true);
 const positions=visitors.positions();
 expect(positions).toHaveLength(17);
 visitors.dispose();interactions.dispose();scope.dispose();
 expect(scope.size).toBe(0);
});

it('freezes only the merged static world matrices at their correct parent transform', () => {
 const scope=new ResourceScope('static-world');
 const root=new THREE.Group();
 const parent=new THREE.Group();
 parent.position.set(10,0,20);root.add(parent);
 const material=scope.track(new THREE.MeshStandardMaterial());
 for(const x of [1,3]){
   const mesh=new THREE.Mesh(scope.track(new THREE.BoxGeometry(1,1,1)),material);
   mesh.position.x=x;parent.add(mesh);
 }
 const result=mergeStatic(root,scope,{cellSize:72,preserveTopLevel:true});
 expect(result.merged).toBe(2);
 expect(parent.children).toHaveLength(1);
 const merged=parent.children[0] as THREE.Mesh;
 expect(merged.matrixWorldAutoUpdate).toBe(false);
 const before=merged.matrixWorld.clone();
 root.updateMatrixWorld(true);
 expect(merged.matrixWorld.equals(before)).toBe(true);
 const sphere=merged.geometry.boundingSphere!;
 const worldCentre=sphere.center.clone().applyMatrix4(merged.matrixWorld);
 expect(worldCentre.x).toBeCloseTo(12,4);
 expect(worldCentre.z).toBeCloseTo(20,4);
 scope.dispose();
});

it('reuses E22 authored stroke curves across updates and streaming remounts', async () => {
 installExhibits();
 const module=createExhibit('E22')!;
 const record=EXHIBITS_BY_ID.get('E22')!;
 const host=new ExhibitHost(module,record,{
   addControl:()=>()=>{}, announce:()=>{}, reducedMotion:()=>false,
   detailScale:()=>1, loadAsset:async()=>new THREE.Group(),
 });
 await host.preload();
 host.mount();
 const runtime=module as unknown as {
   strokeCurves: THREE.CatmullRomCurve3[];
   draw:()=>void;
 };
 expect(runtime.strokeCurves).toHaveLength(6);
 runtime.draw();
 const firstCurve=runtime.strokeCurves[0];
 const firstPoint=firstCurve.points[0];
 host.activate(0);
 for(let frame=0;frame<12;frame++) host.update(1/60,[0,0,0],frame/60);
 expect(runtime.strokeCurves[0]).toBe(firstCurve);
 expect(runtime.strokeCurves[0].points[0]).toBe(firstPoint);
 host.unmount();
 host.mount();
 expect(runtime.strokeCurves).toHaveLength(6);
 host.dispose();
});
