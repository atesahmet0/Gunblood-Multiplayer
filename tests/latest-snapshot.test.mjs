import test from 'node:test';import assert from 'node:assert/strict';
import {LatestSnapshot,latestFrame} from '../docs/latest-snapshot.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
test('slow decompression keeps only one pending packet and never runs in parallel',async()=>{
 let active=0,max=0;const resolvers=[],decoded=[],delivered=[];
 const q=new LatestSnapshot(packet=>{decoded.push(packet);active++;max=Math.max(max,active);return new Promise(resolve=>resolvers.push(()=>{active--;resolve(packet);}));},v=>delivered.push(v),e=>{throw e;});
 q.push(1);for(let i=2;i<=100;i++)q.push(i);assert.deepEqual(decoded,[1]);resolvers.shift()();await flush();assert.deepEqual(decoded,[1,100]);resolvers.shift()();await flush();assert.deepEqual(delivered,[1,100]);assert.equal(max,1);q.close();
});
test('closing cancels pending packets and cannot render an in-flight decode',async()=>{
 let finish;const frames=[];const q=new LatestSnapshot(()=>new Promise(r=>finish=r),s=>frames.push(s),()=>{});q.push(1);q.push(2);q.close();finish(1);await flush();assert.deepEqual(frames,[]);assert.equal(q.pending,null);
});
test('decoder errors are handled and close the receiver',async()=>{
 const errors=[];let q;q=new LatestSnapshot(async()=>{throw Error('invalid gzip');},()=>assert.fail('rendered malformed packet'),e=>{errors.push(e.message);q.close();});q.push(1);await flush();assert.deepEqual(errors,['invalid gzip']);q.push(2);await flush();assert.equal(errors.length,1);
});
test('rendering coalesces a burst to its newest tick and cancels after close',()=>{
 const callbacks=[],frames=[],cancelled=[];const renderer=latestFrame(s=>frames.push(s),cb=>{callbacks.push(cb);return callbacks.length;},id=>cancelled.push(id));
 renderer.push({round:1,tick:4});renderer.push({round:1,tick:7});renderer.push({round:1,tick:5});assert.equal(callbacks.length,1);callbacks.shift()();assert.deepEqual(frames,[{round:1,tick:7}]);renderer.push({round:1,tick:8});renderer.close();callbacks.shift()();assert.equal(frames.length,1);assert.equal(cancelled.length,1);
});
