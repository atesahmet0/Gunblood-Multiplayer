import test from 'node:test';import assert from 'node:assert/strict';
import {treePatch,bridgeSnapshot} from '../docs/render-snapshot.mjs';
const tree=(n='root')=>({n,d:1,f:1,x:0,y:0,sx:100,sy:100,r:0,a:100,v:true,c:[]});
function expand(previous,patch){if(patch===null)return previous;return {...patch,c:patch.c.map((c,i)=>expand(previous?.c[i],c))};}
test('bridge patches reconstruct complete state after loss, reordered children, deaths and reset',()=>{
 let old=null;const a=tree();a.c=[tree('char'),tree('blood1')];a.c[0].c=[tree('head')];
 for(const next of [a,structuredClone(a),{...a,x:33}, {...a,c:[{...a.c[0],f:80,c:[{...a.c[0].c[0],r:20}]}]}, {...a,c:[tree('smoke1'),tree('char')]},tree()]){
  const patch=treePatch(next,old);assert.deepEqual(expand(old,patch),next);assert.deepEqual(next,structuredClone(next));old=next;
 }
 assert.equal(treePatch(old,old),null);assert.deepEqual(treePatch(a,null),a);
});
test('unchanged branches do not cross the Flash bridge; skipped network ticks need no baseline',()=>{
 const a=tree();a.c=[tree('char'),tree('char2')];const b=structuredClone(a);b.c[0].r=15;
 const patch=treePatch(b,a);assert.equal(patch.c[1],null);assert.equal(patch.c[0].r,15);assert.equal(a.c[0].r,0);
 const snapshot={tree:a,bigText:tree('big'),barrels:[tree('b1'),tree('b2')],bars:[tree('h1'),tree('h2')],health:[100,100],round:1,tick:7};
 const first=bridgeSnapshot(snapshot,null);assert.equal(first.delta,1);assert.deepEqual(first.tree,a);const second=bridgeSnapshot({...snapshot,tick:20},snapshot);assert.equal(second.tree,null);assert.deepEqual(second.barrels,[null,null]);assert.deepEqual(second.health,[100,100]);assert.equal(second.tick,20);
});
