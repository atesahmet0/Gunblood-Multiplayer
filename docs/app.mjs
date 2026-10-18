import {QuickMatch,QUICK_SLOT} from './quick-match.mjs';
import {createAnalytics,createRoundAnalytics} from './analytics.mjs';
import {ANALYTICS_ACCOUNT} from './analytics-config.mjs';
import {roomCode} from './lobby.mjs';
import {Peer} from './peer.mjs';
import {BUILD,input} from './protocol.mjs';
const $=s=>document.querySelector(s);
const capture=createAnalytics({location,navigator,account:ANALYTICS_ACCOUNT});
capture('$pageview');
let trackRound=createRoundAnalytics(capture);
let remoteSceneReady=false;
let quickMatch,searchClock,searchStarted=0;
let peer,role,player,poll,seq=0,lastAim=-1,lastFire=-1,round=1,lastSnapshot=-1,lastState='',myRematch=false,theirRematch=false,ended=false,busy=false,starting=false,lastRemote=0,hostPaused=false,needLeave=false;
let pointer={x:0,y:0,ready:false,fire:false};
function status(text,error=false){$('#feedback').hidden=!text;$('#status').textContent=text;$('#status').classList.toggle('error',error);}
function call(name,...args){return player?.ruffle().callExternalInterface(name,...args);}
function error(message){status(message,true);$('#retry').hidden=false;ended=true;$('#rematch').hidden=true;$('#leave').hidden=true;clearInterval(poll);call('mpSetPaused',true);player?.pause();}
async function action(fn){try{await fn();}catch(e){status(e.message,true);$('#retry').hidden=false;}}
async function loadPlayer(){
 const owner=peer,engine=RufflePlayer.newest().createPlayer();player=engine;$('#player').replaceChildren(engine);await engine.load({url:'gunblood-multiplayer.swf',allowScriptAccess:true});
 await new Promise((resolve,reject)=>{const start=Date.now();let prepared=false;const id=setInterval(()=>{if(owner!==peer||owner.closed){clearInterval(id);reject(Error('Pairing cancelled'));return;}const invoke=(name,...args)=>engine.ruffle().callExternalInterface(name,...args);const boot=invoke('mpPing');if(!prepared&&boot?.loaded===boot?.total&&boot?.build===BUILD){prepared=true;invoke('mpPrepare');}if(invoke('mpPing')?.build===BUILD&&invoke('mpPing')?.ready){clearInterval(id);resolve();}else if(Date.now()-start>20000){clearInterval(id);reject(Error('The game did not initialize. Reload and try again.'));}},100);});
}
async function startRound(number){
 const owner=peer;starting=true;round=number;if(number>1)remoteSceneReady=false;lastSnapshot=-1;lastAim=-1;lastFire=-1;myRematch=false;theirRematch=false;$('#rematch').hidden=true;$('#rematch').disabled=false;
 pointer.ready=false;pointer.fire=false;needLeave=true;if(number>1){player.pause();await loadPlayer();}if(owner!==peer||owner.closed)return;player.play();call('mpStart',role);
 await new Promise((resolve,reject)=>{let start=Date.now();let id=setInterval(()=>{if(owner!==peer||owner.closed){clearInterval(id);reject(Error('Pairing cancelled'));return;}if(call('mpInspect')?.role===role){clearInterval(id);resolve();}else if(Date.now()-start>10000){clearInterval(id);reject(Error('The arena did not initialize. Retry pairing.'));}},30);});
 if(owner!==peer||owner.closed)return;
 if(ended)throw Error('Peer left during startup. Retry with fresh codes.');
 lastState='';lastRemote=Date.now();hostPaused=false;starting=false;status('Connected directly. Both players: move onto your own chamber to ready.');
 if(role==='guest')peer.send('sceneReady',{round});
 else{call('mpSetPaused',!remoteSceneReady||document.hidden);if(remoteSceneReady)finishQuickMatch();} // Resume only after guest confirms the scene.
}
async function connected(){
 const owner=peer;$('#matching').hidden=true;
 $('#pairing').hidden=true;$('#exchange').hidden=true;$('#game').hidden=false;$('#retry').hidden=true;document.body.dataset.screen='game';$('#game-feedback').append($('#feedback'));$('#left-you').hidden=role!=='host';$('#right-you').hidden=role!=='guest';
 $('#side').textContent=role==='host'?'You are LEFT · Host':'You are RIGHT · Guest';
 status('Connected. Initializing both arenas…');
 try{await loadPlayer();if(ended||owner!==peer||owner.closed)return;await startRound(1);if(ended||owner!==peer||owner.closed)return;poll=setInterval(tick,80);}catch(e){if(owner===peer&&!owner.closed){if(quickMatch?.state==='pairing')recoverQuickMatch(e.message);else{error(e.message);owner.close();}}}
}
function setPeer(r){
 role=r;ended=false;remoteSceneReady=false;round=1;starting=true;seq=0;trackRound=createRoundAnalytics(capture);
 const active=new Peer(role,{open:()=>{if(peer===active)connected();},error:message=>{if(peer!==active)return;if(quickMatch?.state==='pairing')recoverQuickMatch(message);else error(message);},message:(...args)=>{if(peer===active)onMessage(...args);},snapshot:s=>{if(peer===active)onSnapshot(s);},progress:(...args)=>{if(peer===active)status(...args);},code:code=>{ $('#outgoing').value=code;$('#outgoing-wrap').hidden=false;$('#exchange').removeAttribute('aria-busy');$('#step').textContent='Invite your friend';status('Room ready. Share this six-digit code and keep this tab open.'); }});peer=active;
}
function onMessage(type,data,channel){
 if(ended||!data)return;
 if(type==='input'&&role==='host'&&data.round===round){
  const v=input(data);if(!v)return;
  lastRemote=Date.now();
  if(channel==='state'){
   if(v.seq<=lastAim)return;lastAim=v.seq;
   call('mpInput',1,v.x,v.y,v.ready&&!hostPaused,false);
  }else if(channel==='control'&&v.fire&&v.seq>lastFire){
   lastFire=v.seq;call('mpInput',1,v.x,v.y,false,!hostPaused);
  }
 }
 if(type==='sceneReady'&&role==='host'&&data.round===round){remoteSceneReady=true;if(!starting){call('mpSetPaused',document.hidden);hostPaused=document.hidden;finishQuickMatch();}}
 if(type==='pause'&&role==='guest'){
  hostPaused=data.paused===true;pointer.ready=false;needLeave=true;
  $('#suspend').hidden=false;status(hostPaused?'Host tab is hidden. Duel paused.':'Host returned. Leave your chamber, then both ready again.');
 }
 if(type==='round'&&role==='guest'&&data.round===round)showState(data);
 if(type==='rematch'&&data.round===round){theirRematch=true;status('Your opponent wants a rematch. Accept to play again.');maybeRematch();}
 if(type==='startRound'&&role==='guest'&&data.round===round+1)action(()=>startRound(data.round));
}
function showState(s){
 const label=s.paused?'Paused':s.state==='finished'?(s.result==='draw'?'Draw':s.result==='left'?'Left wins':'Right wins'):s.state==='playing'?'FIRE!':s.state==='countdown'?String(3-Math.min(2,Math.floor(s.count/20))):`Ready: left ${s.ready?.[0]?'yes':'no'} · right ${s.ready?.[1]?'yes':'no'}`;
 if($('#round').textContent!==label)$('#round').textContent=label;
 for(const [i,side] of ['left','right'].entries()){
  const health=Math.max(0,Math.round(s.health[i]));
  $('#'+side+'-health').textContent=health;$('#'+side+'-ammo').textContent=s.ammo[i];$('#'+side+'-meter').value=health;
 }
 if(s.state==='playing'||s.state==='finished')$('#suspend').hidden=true;
 if(s.state==='finished'){$('#rematch').hidden=false;$('#rematch').textContent=myRematch?'Rematch requested':theirRematch?'Accept rematch':'Request rematch';}
}

function onSnapshot(s){
 if(ended||starting||role!=='guest'||s.round!==round||s.version!==1||!Number.isSafeInteger(s.tick)||s.tick<=lastSnapshot)return;
 if(!Array.isArray(s.health)||!Array.isArray(s.ammo)||!s.tree)return;
 lastSnapshot=s.tick;call('mpApply',s);showState(s);finishQuickMatch();
}
async function tick(){
 if(ended||starting||busy)return;busy=true;
 try{
  if(role==='host'){
   if(Date.now()-lastRemote>1500)call('mpInput',1,0,0,false,false);
   call('mpInput',0,pointer.x,pointer.y,pointer.ready&&!hostPaused,pointer.fire&&!hostPaused);
   pointer.fire=false;
   const s=call('mpSnapshot');if(!s)return;s.round=round;showState(s);trackRound(round,s);
   const key=s.state+':'+s.result+':'+s.paused;
   if(key!==lastState){lastState=key;peer.send('round',{round,state:s.state,result:s.result,count:s.count,paused:s.paused,health:s.health,ammo:s.ammo});}
   await peer.snapshot(s);
  }else{
   peer.send('input',{...pointer,fire:false,seq:seq++,round},'state');
  }
 }catch(e){error('Game synchronization failed: '+e.message);peer?.close();}finally{busy=false;}
}
function maybeRematch(){
 if(role==='host'&&myRematch&&theirRematch){peer.send('startRound',{round:round+1});action(()=>startRound(round+1));}
}
function chooseMode(mode){
 document.body.dataset.screen=mode;$('#choice-screen').hidden=true;$('#exchange').hidden=false;$('#join-fields').hidden=mode==='host';$('#outgoing-wrap').hidden=true;$('#retry').hidden=true;
 $('#step').textContent=mode==='host'?'Create your room':'Enter your friend’s code';
 $('#instruction').textContent=mode==='host'?'Share your six-digit code. Your friend enters it under Join Game; you connect automatically.':'Ask the host for their six-digit code, then connect.';
}
$('#host').onclick=()=>action(async()=>{
 chooseMode('host');setPeer('host');$('#exchange').setAttribute('aria-busy','true');$('#step').focus();status('Reserving your room through PeerJS public signaling…');
 try{await peer.host();}catch(e){peer.close();$('#exchange').removeAttribute('aria-busy');throw e;}
});
$('#join').onclick=()=>{
 chooseMode('join');status('Waiting for the host’s six-digit code.');$('#incoming').focus();
};
$('#back').onclick=()=>{peer?.close();location.reload();};
$('#apply').onclick=()=>action(async()=>{
 let code;
 try{code=roomCode($('#incoming').value);}catch(e){$('#incoming').setAttribute('aria-invalid','true');$('#code-error').textContent=e.message;$('#code-error').hidden=false;$('#incoming').focus();status('Check the six-digit code above.',true);return;}
 $('#incoming').removeAttribute('aria-invalid');$('#code-error').hidden=true;
 $('#apply').disabled=true;$('#apply').textContent='Connecting…';$('#incoming').readOnly=true;$('#retry').hidden=true;setPeer('guest');
 status('Finding the host through PeerJS public signaling…');
 try{await peer.join(code);}catch(e){peer.close();throw e;}
});
$('#incoming').oninput=()=>{$('#incoming').removeAttribute('aria-invalid');$('#code-error').hidden=true;if(!peer)status('Waiting for the host’s six-digit code.');};
$('#incoming').onkeydown=e=>{if(e.key==='Enter')$('#apply').click();};
$('#copy').onclick=async()=>{
 try{await navigator.clipboard.writeText($('#outgoing').value);$('#copy').textContent='Copied';status('Code copied. Send it privately to your friend.');setTimeout(()=>$('#copy').textContent='Copy code',2000);}
 catch{$('#outgoing').focus();$('#outgoing').select();status('Select the room code and copy it manually. Clipboard access is unavailable.',true);}
};
$('#retry').onclick=()=>{if(document.body.dataset.screen==='quick'){beginQuickMatch();return;}peer?.close();location.reload();};
$('#leave').onclick=()=>{quickMatch?.cancel();clearInterval(searchClock);peer?.close();error('You left the duel. Retry to start a fresh session.');};
$('#rematch').onclick=()=>{myRematch=true;$('#rematch').disabled=true;$('#rematch').textContent='Rematch requested';peer.send('rematch',{round});status('Rematch requested. Waiting for your opponent.');maybeRematch();};
function move(e){
 const b=$('#arena').getBoundingClientRect();pointer.x=(e.clientX-b.left)*720/b.width;pointer.y=(e.clientY-b.top)*425/b.height;
 const own=role==='host'?pointer.x<130:pointer.x>590;
 const over=own&&pointer.y>370;
 if(!over)needLeave=false;
 pointer.ready=over&&!needLeave&&!hostPaused;
}
$('#input').onpointermove=move;
$('#input').onpointerleave=()=>{pointer.ready=false;needLeave=false;};
$('#input').onpointerdown=e=>{move(e);if(role==='host')pointer.fire=true;else peer?.send('input',{...pointer,ready:false,fire:true,seq:seq++,round});};
// Ruffle is pinned: dispatch its unmute UI action within the user's click activation.
$('#input').onclick=()=>player?.shadowRoot?.querySelector('#unmute-overlay')?.click();
$('#input').oncontextmenu=e=>e.preventDefault();
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&['searching','pairing'].includes(quickMatch?.state)){quickMatch.cancel();showMatchFailure('Search cancelled because the tab was hidden. Try again when you are ready.');return;}
 if(role==='host'&&player&&peer?.opened&&!ended){
  hostPaused=document.hidden;pointer.ready=false;pointer.fire=false;needLeave=true;
  // Pause the engine before suspending Ruffle, then restore only a readiness phase.
  if(document.hidden){call('mpSetPaused',true);player.pause();}
  else{player.play();call('mpSetPaused',false);}
  peer.send('pause',{paused:document.hidden,round});$('#suspend').hidden=false;
 }else if(role==='guest'&&peer?.opened){pointer.ready=false;peer.send('input',{...pointer,seq:seq++,round},'state');}
});
window.addEventListener('pagehide',()=>{quickMatch?.cancel();peer?.close();});
window.addEventListener('unhandledrejection',e=>error(e.reason?.message||'Unexpected error. Retry to start again.'));

const fullscreenButton=$('#fullscreen');
const fullscreenGame=$('#game');
fullscreenButton.hidden=!document.fullscreenEnabled;
function syncFullscreen(){
 const active=document.fullscreenElement===fullscreenGame;
 fullscreenButton.textContent=active?'Exit fullscreen':'Fullscreen';
 fullscreenButton.setAttribute('aria-pressed',String(active));
 // A resized arena must be readied again with a fresh pointer position.
 pointer.ready=false;pointer.fire=false;needLeave=true;
}
fullscreenButton.onclick=async()=>{
 try{
  if(document.fullscreenElement===fullscreenGame)await document.exitFullscreen();
  else await fullscreenGame.requestFullscreen();
 }catch{status('Fullscreen is unavailable. Try the browser’s fullscreen control.',true);}
};
document.addEventListener('fullscreenchange',syncFullscreen);

function restoreMatching(){
 $('#game').hidden=true;$('#pairing').hidden=false;$('#matching').hidden=false;$('#choice-screen').hidden=true;$('#exchange').hidden=true;
 $('.pair-panel').append($('#feedback'));document.body.dataset.screen='quick';
}
function finishQuickMatch(){if(quickMatch?.state==='pairing'){quickMatch.complete();clearInterval(searchClock);}}
function detachQuickPeer(){const old=peer;peer=null;old?.close();player?.pause();clearInterval(poll);starting=false;busy=false;}
function recoverQuickMatch(message){detachQuickPeer();restoreMatching();quickMatch.resume('Pairing did not finish. Finding another opponent… Some networks require a relay, which this game does not use.');}
function showMatchFailure(message){
 detachQuickPeer();restoreMatching();clearInterval(searchClock);ended=true;$('#matching-title').textContent='Search stopped';$('#matching-description').textContent='You can try again or return to the lobby.';$('#cancel-match').textContent='Back';status(message,true);$('#retry').hidden=false;
}
function beginQuickMatch(){
 quickMatch?.cancel();detachQuickPeer();ended=false;restoreMatching();$('#matching-title').textContent='Finding an opponent…';$('#matching-description').textContent='Waiting for another player. Keep this tab visible.';$('#cancel-match').textContent='Cancel';$('#retry').hidden=true;
 searchStarted=Date.now();$('#search-elapsed').textContent='0:00';clearInterval(searchClock);
 searchClock=setInterval(()=>{const seconds=Math.floor((Date.now()-searchStarted)/1000);$('#search-elapsed').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');},1000);
 quickMatch=new QuickMatch({progress:message=>status(message==='Finding an opponent…'?'':message),error:showMatchFailure,matched:pair=>{setPeer(pair.role);peer.adoptQuickMatch(pair);}},globalThis.Peer,QUICK_SLOT+(new URLSearchParams(location.search).has('test')||['localhost','127.0.0.1'].includes(location.hostname)?'-test':''));
 quickMatch.start();$('#matching-title').focus();
}
$('#quick-match').onclick=beginQuickMatch;
$('#cancel-match').onclick=()=>{quickMatch?.cancel();detachQuickPeer();clearInterval(searchClock);location.reload();};
