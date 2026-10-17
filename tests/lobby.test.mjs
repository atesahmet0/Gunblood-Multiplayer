import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {Lobby,roomCode,randomCode} from '../docs/lobby.mjs';import {BUILD,VERSION,TTL} from '../docs/protocol.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function setup(role='host',collisions=0){
 const brokers=[];const failures=[];
 class Broker extends EventEmitter{
  constructor(id,options){super();this.id=id;this.options=options;brokers.push(this);queueMicrotask(()=>{if(collisions-->0)this.emit('error',{type:'unavailable-id'});else this.emit('open',id);});}
  connect(id,options){this.target=id;this.metadata=options.metadata;return this.conn=new Connection(options.metadata);}
  destroy(){this.destroyed=true;}
 }
 class Connection extends EventEmitter{constructor(metadata){super();this.metadata=metadata;this.sent=[];}send(m){this.sent.push(m);}close(){this.closed=true;}}
 const transport={role,opened:false,offer:async()=> 'offer',answer:async c=>{assert.equal(c,'offer');return 'answer';},accept:async c=>{assert.equal(c,'answer');transport.accepted=true;},fail:m=>failures.push(m)};
 const lobby=new Lobby(transport,{},Broker);return {lobby,transport,brokers,failures,Connection};
}
test('six digits preserve leading zeros and reject malformed input',()=>{
 assert.equal(roomCode(' 000042 '),'000042');for(const v of ['12345','1234567','123a56','1e0000','１２３４５６'])assert.throws(()=>roomCode(v),/six-digit/);
 for(let i=0;i<100;i++)assert.match(randomCode(),/^\d{6}$/);
});
test('reserved host IDs retry collisions and use STUN only',async()=>{
 const {lobby,brokers}=setup('host',2);await lobby.start();assert.equal(brokers.length,3);assert.ok(brokers[0].destroyed);assert.match(brokers[2].id,/^gunblood-mp1-\d{6}$/);assert.ok(brokers[2].options.config.iceServers.every(s=>s.urls.startsWith('stun:')));lobby.close();assert.ok(brokers[2].destroyed);
});
test('one host admits only one compatible guest; answers bind to attempt',async()=>{
 const {lobby,transport,Connection,failures}=setup();await lobby.start();
 const meta={kind:'gunblood-signaling-1',v:VERSION,build:BUILD,attempt:'a'.repeat(32)};
 const bad=new Connection({...meta,build:'old'});lobby.incoming(bad);bad.emit('open');assert.match(bad.sent[0].message,/Incompatible/);
 const first=new Connection(meta);lobby.incoming(first);first.emit('open');await flush();assert.equal(first.sent[0].type,'offer');
 const extra=new Connection(meta);lobby.incoming(extra);extra.emit('open');assert.match(extra.sent[0].message,/already has a guest/);
 first.emit('data',{type:'answer',attempt:meta.attempt,code:'answer'});await flush();assert.equal(transport.accepted,true);assert.equal(lobby.exchanged,true);assert.deepEqual(failures,[]);lobby.close();
});
test('stale handshake cannot accept an answer from another attempt',async()=>{
 const {lobby,transport,Connection,failures}=setup();await lobby.start();const c=new Connection({kind:'gunblood-signaling-1',v:VERSION,build:BUILD,attempt:'a'.repeat(32)});lobby.incoming(c);c.emit('open');await flush();c.emit('data',{type:'answer',attempt:'b'.repeat(32),code:'answer'});await flush();assert.equal(transport.accepted,undefined);assert.match(failures[0],/Invalid pairing/);assert.equal(lobby.closed,true);
});
test('guest targets the exact six-digit room; missing host gives a clear failure',async()=>{
 const {lobby,brokers,failures}=setup('guest');await lobby.start('000042');assert.equal(brokers[0].target,'gunblood-mp1-000042');brokers[0].emit('error',{type:'peer-unavailable'});assert.match(failures[0],/No host/);assert.equal(lobby.closed,true);assert.ok(brokers[0].destroyed);
});
test('room expiration and unavailable signaling end pairing, not an established game',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const {lobby,failures}=setup();await lobby.start();t.mock.timers.tick(TTL);assert.match(failures[0],/expired/);
 const s=setup();await s.lobby.start();s.brokers[0].emit('disconnected');assert.match(s.failures[0],/unavailable/);
 const connected=setup();await connected.lobby.start();connected.transport.opened=true;connected.lobby.close();connected.brokers[0].emit('disconnected');assert.deepEqual(connected.failures,[]);
});
