import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalytics,createRoundAnalytics} from '../docs/analytics.mjs';
test('one host event per duel, pause/resume does not count again, rematches count separately',()=>{
 const events=[];const track=createRoundAnalytics((...args)=>events.push(args));
 for(const state of ['waiting','countdown','playing','playing','waiting','playing','finished','finished'])track(1,{state,result:'left'});
 track(2,{state:'playing'});track(2,{state:'finished',result:'draw'});
 assert.deepEqual(events,[['game_started',{is_rematch:false}],['game_completed',{is_rematch:false,result:'left'}],['game_started',{is_rematch:true}],['game_completed',{is_rematch:true,result:'draw'}]]);
});
function environment(overrides={}){
 return {location:{hostname:'atesahmet0.github.io',pathname:'/Gunblood-Multiplayer/',search:'',hash:''},navigator:{},account:'gunblood-multiplayer',load:()=>Promise.reject(Error('blocked')),...overrides};
}
test('local, test, other sites and privacy preferences do not load analytics',()=>{
 for(const extra of [{location:{hostname:'localhost'}},{location:{hostname:'atesahmet0.github.io',pathname:'/Gunblood-Multiplayer/',search:'?test=1'}},{navigator:{doNotTrack:'1'}},{navigator:{globalPrivacyControl:true}}]){
  let loads=0;createAnalytics(environment({...extra,load:()=>{loads++;return Promise.resolve(()=>{});}}))('$pageview');assert.equal(loads,0);
 }
});
test('blocked loader and failed analytics never throw or affect gameplay',async()=>{
 const capture=createAnalytics(environment());assert.doesNotThrow(()=>capture('game_started'));await Promise.resolve();assert.doesNotThrow(()=>capture('game_completed'));
 const broken=createAnalytics(environment({load:()=>Promise.resolve(()=>{throw Error('blocked');})}));await Promise.resolve();assert.doesNotThrow(()=>broken('game_started'));
});
test('queued events preserve exact game totals, rematches and safe page URL',async()=>{
 const sent=[];const capture=createAnalytics(environment({location:{hostname:'atesahmet0.github.io',pathname:'/Gunblood-Multiplayer/',search:'?utm_source=friend',hash:'#private'},load:()=>Promise.resolve(v=>sent.push(v))}));
 capture('$pageview');capture('game_started',{is_rematch:false});capture('game_started',{is_rematch:true});capture('game_completed',{result:'left'});await Promise.resolve();
 assert.deepEqual(sent.map(v=>v.path),['/Gunblood-Multiplayer/','game_started','game_started','rematch_started','game_completed']);
 assert.equal(sent[0].event,false);assert.equal(sent[0].no_session,false);
 assert.ok(sent.slice(1).every(v=>v.event&&v.no_session));
 assert.ok(sent.every(v=>v.referrer===''));
 assert.equal(JSON.stringify(sent).includes('utm_source'),false);assert.equal(JSON.stringify(sent).includes('private'),false);
});

test('bundled counter never sends raw query parameters',async()=>{const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../docs/runtime/goatcounter.js',import.meta.url),'utf8');assert.ok(source.includes("q: '', // Gunblood"));assert.ok(!source.includes('q: location.search'));});
