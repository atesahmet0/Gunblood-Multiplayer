import test from 'node:test';import assert from 'node:assert/strict';
import {encodeCode,decodeCode,input,winner,TTL} from '../docs/protocol.mjs';
const sid='a'.repeat(32),sdp='v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',now=1000000;
test('versioned offer and answer roundtrip',()=>{for(const type of ['offer','answer'])assert.equal(decodeCode(encodeCode(type,sid,sdp,now),type,sid,now).sdp,sdp);});
test('reject malformed, wrong type, different session, stale and future codes',()=>{
 assert.throws(()=>decodeCode('bad','offer'));
 assert.throws(()=>decodeCode('GB1.@@','offer'));
 const c=encodeCode('offer',sid,sdp,now);
 assert.throws(()=>decodeCode(c,'answer',sid,now),/Expected/);
 assert.throws(()=>decodeCode(c,'offer','b'.repeat(32),now),/another session/);
 assert.throws(()=>decodeCode(c,'offer',sid,now+TTL+1),/Expired/);
 assert.throws(()=>decodeCode(c,'offer',sid,now-120000),/invalid/);
 for(const field of ['v','build']){let x=JSON.parse(atob(c.slice(4)));x[field]='incompatible';assert.throws(()=>decodeCode('GB1.'+btoa(JSON.stringify(x)),'offer',sid,now),/Incompatible/);}
});
test('guest messages allow finite inputs only, discard claimed damage and side',()=>{
 assert.equal(input({seq:0,x:NaN,y:1}),null);
 assert.equal(input({seq:-1,x:1,y:1}),null);
 assert.deepEqual(input({seq:3,x:-10,y:900,fire:1,ready:true,damage:100,side:0}),{seq:3,x:0,y:425,ready:true,fire:false});
});
test('winner resolved from both post-tick health values',()=>{assert.equal(winner(0,0),'draw');assert.equal(winner(0,100),'right');assert.equal(winner(100,0),'left');assert.equal(winner(100,100),null);assert.equal(winner(20,30,true),'draw');});
