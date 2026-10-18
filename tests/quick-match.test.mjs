import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {QuickMatch,QUICK_SLOT,QUICK_TIMEOUT} from '../docs/quick-match.mjs';
import {Lobby} from '../docs/lobby.mjs';
import {BUILD,VERSION} from '../docs/protocol.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
async function until(fn){const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('matching timeout');await new Promise(r=>setTimeout(r,20));}}
function network(){
 const slots=new Map(),all=[],control={};
 class Connection extends EventEmitter{
  constructor(metadata){super();this.metadata=metadata;this.open=false;this.closed=false;}
  send(m){if(control.drop?.(m))return;if(!this.closed)queueMicrotask(()=>{if(!this.other.closed)this.other.emit('data',structuredClone(m));});}
  close(){if(this.closed)return;this.closed=true;this.open=false;this.emit('close');if(this.other)this.other.close();}
 }
 class Broker extends EventEmitter{
  constructor(id,options){super();this.id=id;this.options=options;this.connections=[];all.push(this);queueMicrotask(()=>{if(this.destroyed)return;if(slots.has(id)){this.emit('disconnected');this.emit('error',{type:'unavailable-id'});}else{slots.set(id,this);this.emit('open',id);}});}
  connect(id,options){const local=new Connection(options.metadata),remote=new Connection(options.metadata);local.other=remote;remote.other=local;this.connections.push(local);queueMicrotask(()=>{const target=slots.get(id);if(!target){this.emit('error',{type:'peer-unavailable'});return;}target.connections.push(remote);target.emit('connection',remote);queueMicrotask(()=>{if(local.closed)return;local.open=remote.open=true;remote.emit('open');local.emit('open');});});return local;}
  disconnect(){if(slots.get(this.id)===this)slots.delete(this.id);this.disconnected=true;this.emit('disconnected');}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.disconnect();for(const c of this.connections)c.close();}
 }
 return {Broker,slots,all,control,close(){for(const b of all)b.destroy();}};
}
test('five simultaneous arrivals produce disjoint pairs and leave one free waiting slot',async()=>{
 const n=network(),pairs=[],errors=[],qs=Array.from({length:5},(_,i)=>new QuickMatch({matched:p=>{pairs.push({i,...p});qs[i].complete();},error:e=>errors.push(e)},n.Broker));
 try{
  qs.forEach(q=>q.start());await until(()=>pairs.length===4);
  assert.equal(new Set(pairs.map(p=>p.i)).size,4);assert.equal(pairs.filter(p=>p.role==='host').length,2);
  const matches=new Map();for(const p of pairs){if(!matches.has(p.match))matches.set(p.match,[]);matches.get(p.match).push(p);assert.equal(p.broker.disconnected,true);assert.equal(p.broker.destroyed,undefined);assert.equal(p.connection.open,true);}
  assert.equal(matches.size,2);assert.ok([...matches.values()].every(ps=>ps.length===2&&ps[0].role!==ps[1].role));
  await until(()=>n.slots.has(QUICK_SLOT));assert.equal(qs.filter(q=>q.state==='searching').length,1);assert.deepEqual(errors,[]);
  const first=[...matches.values()][0];first[0].broker.destroy();const other=[...matches.values()][1];assert.ok(other.every(p=>p.connection.open));
 }finally{qs.forEach(q=>q.cancel());n.close();}
});
test('cancelling registration or a waiting host releases all owned resources',async()=>{
 const n=network();const a=new QuickMatch({},n.Broker);a.start();a.cancel();await flush();assert.equal(n.slots.size,0);
 const b=new QuickMatch({},n.Broker);b.start();await flush();assert.ok(n.slots.has(QUICK_SLOT));b.cancel();assert.equal(n.slots.size,0);assert.ok(n.all.every(p=>p.destroyed));n.close();
});
test('a disappearing waiting host is retried and cannot create a stale match',async()=>{
 const n=network(),pairs=[],a=new QuickMatch({matched:p=>pairs.push(p)},n.Broker),b=new QuickMatch({matched:p=>pairs.push(p)},n.Broker);
 try{a.start();await flush();b.start();a.cancel();await until(()=>n.slots.has(QUICK_SLOT)&&n.slots.get(QUICK_SLOT)!==a.broker);assert.equal(pairs.length,0);assert.equal(b.state,'searching');}finally{a.cancel();b.cancel();n.close();}
});
test('incompatible metadata is rejected without reserving the waiting slot',async()=>{
 const n=network(),a=new QuickMatch({},n.Broker);try{a.start();await flush();const bad=new EventEmitter();bad.metadata={kind:'gunblood-quick-1',v:VERSION,build:'old',attempt:'a'.repeat(32)};bad.open=true;bad.send=m=>{bad.sent=m;};bad.close=()=>{};a.incoming(bad,a.epoch);assert.equal(bad.sent.type,'incompatible');assert.equal(a.conn,null);assert.ok(n.slots.has(QUICK_SLOT));}finally{a.cancel();n.close();}
});
test('search ends at two minutes even after handoff; completed games do not expire',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const n=network(),errors=[],q=new QuickMatch({error:e=>errors.push(e)},n.Broker);q.start();await flush();t.mock.timers.tick(QUICK_TIMEOUT);assert.equal(q.state,'failed');assert.match(errors[0],/two minutes/);assert.equal(n.slots.size,0);
 const done=new QuickMatch({},n.Broker);done.start();await flush();done.state='pairing';done.complete();t.mock.timers.tick(QUICK_TIMEOUT);assert.equal(done.state,'done');done.cancel();n.close();
});
test('adopted signaling waits for guest readiness and retains validated offer/answer flow',async()=>{
 const n=network(),lobbies=[],errors=[],transports=[],qs=[];
 try{
  for(let i=0;i<2;i++){
   const q=new QuickMatch({matched:pair=>{
    const t={role:pair.role,opened:false,offer:async()=> 'offer',answer:async s=>{assert.equal(s,'offer');return 'answer';},accept:async s=>{assert.equal(s,'answer');t.accepted=true;},fail:e=>errors.push(e)};transports.push(t);
    const lobby=new Lobby(t);lobbies.push(lobby);lobby.adopt(pair);q.complete();
   }},n.Broker);qs.push(q);q.start();
  }
  await until(()=>transports.some(t=>t.accepted));assert.ok(lobbies.every(l=>l.exchanged));assert.deepEqual(errors,[]);
  assert.ok(n.all.every(b=>b.options.config.iceServers.every(s=>s.urls.startsWith('stun:'))));
 }finally{lobbies.forEach(l=>l.close());qs.forEach(q=>q.cancel());n.close();}
});

test('cancellation during reservation cannot commit a late acceptance',async()=>{
 const n=network(),pairs=[],qs=[0,1].map(()=>new QuickMatch({matched:p=>pairs.push(p)},n.Broker));n.control.drop=m=>m.type==='accepted';
 try{qs[0].start();qs[1].start();await until(()=>qs[1].match);const host=qs.find(q=>q.role==='host'),guest=qs.find(q=>q.role==='guest'),old=host.conn;guest.cancel();old.emit('data',{type:'accepted',attempt:host.attempt,match:host.match});await flush();assert.equal(pairs.length,0);assert.equal(guest.state,'cancelled');assert.equal(host.state,'searching');}finally{qs.forEach(q=>q.cancel());n.close();}
});
test('stale reservation IDs cannot hand off; signaling errors stop with a retry message',async()=>{
 const n=network(),pairs=[],q=new QuickMatch({matched:p=>pairs.push(p)},n.Broker);
 try{q.start();await flush();const guest=new n.Broker('bad-guest',{});await flush();const c=guest.connect(QUICK_SLOT,{metadata:{kind:'gunblood-quick-1',v:VERSION,build:BUILD,attempt:'a'.repeat(32)}});await flush();c.send({type:'accepted',attempt:'b'.repeat(32),match:'c'.repeat(32)});await flush();assert.equal(pairs.length,0);assert.equal(q.state,'searching');q.cancel();
 const errors=[],failed=new QuickMatch({error:e=>errors.push(e)},n.Broker);failed.start();await flush();failed.broker.emit('error',{type:'network'});assert.equal(failed.state,'failed');assert.match(errors[0],/Try again/);assert.equal(n.slots.has(QUICK_SLOT),false);failed.cancel();
 }finally{q.cancel();n.close();}
});

test('test rendezvous is isolated from the public matchmaking pool',async()=>{
 const n=network(),pairs=[],a=new QuickMatch({matched:p=>pairs.push(p)},n.Broker),b=new QuickMatch({matched:p=>pairs.push(p)},n.Broker,QUICK_SLOT+'-test');
 try{a.start();b.start();await flush();assert.equal(n.slots.size,2);assert.equal(pairs.length,0);assert.equal(a.role,'host');assert.equal(b.role,'host');}finally{a.cancel();b.cancel();n.close();}
});
