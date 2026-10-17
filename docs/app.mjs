import {roomCode} from './lobby.mjs';
import {Peer} from './peer.mjs';
import {BUILD,input} from './protocol.mjs';
const $=s=>document.querySelector(s);
let remoteSceneReady=false;
let peer,role,player,poll,seq=0,lastAim=-1,lastFire=-1,round=1,lastSnapshot=-1,lastState='',myRematch=false,theirRematch=false,ended=false,busy=false,starting=false,lastRemote=0,hostPaused=false,needLeave=false;
let pointer={x:0,y:0,ready:false,fire:false};
function status(text,error=false){$('#feedback').hidden=!text;$('#status').textContent=text;$('#status').classList.toggle('error',error);}
function call(name,...args){return player?.ruffle().callExternalInterface(name,...args);}
function error(message){status(message,true);$('#retry').hidden=false;ended=true;$('#rematch').hidden=true;$('#leave').hidden=true;clearInterval(poll);call('mpSetPaused',true);player?.pause();}
async function action(fn){try{await fn();}catch(e){status(e.message,true);$('#retry').hidden=false;}}
async function loadPlayer(){
 player=RufflePlayer.newest().createPlayer();$('#player').replaceChildren(player);await player.load({url:'gunblood-multiplayer.swf',allowScriptAccess:true});
 await new Promise((resolve,reject)=>{const start=Date.now();let prepared=false;const id=setInterval(()=>{const boot=call('mpPing');if(!prepared&&boot?.loaded===boot?.total&&boot?.build===BUILD){prepared=true;call('mpPrepare');}if(call('mpPing')?.build===BUILD&&call('mpPing')?.ready){clearInterval(id);resolve();}else if(Date.now()-start>20000){clearInterval(id);reject(Error('The game did not initialize. Reload and try again.'));}},100);});
}
async function startRound(number){
 starting=true;round=number;if(number>1)remoteSceneReady=false;lastSnapshot=-1;lastAim=-1;lastFire=-1;myRematch=false;theirRematch=false;$('#rematch').hidden=true;$('#rematch').disabled=false;
 pointer.ready=false;pointer.fire=false;needLeave=true;if(number>1){player.pause();await loadPlayer();}player.play();call('mpStart',role);
 await new Promise((resolve,reject)=>{let start=Date.now();let id=setInterval(()=>{if(call('mpInspect')?.role===role){clearInterval(id);resolve();}else if(Date.now()-start>10000){clearInterval(id);reject(Error('The arena did not initialize. Retry pairing.'));}},30);});
 if(ended)throw Error('Peer left during startup. Retry with fresh codes.');
 lastState='';lastRemote=Date.now();hostPaused=false;starting=false;status('Connected directly. Both players: move onto your own chamber to ready.');
 if(role==='guest')peer.send('sceneReady',{round});
 else call('mpSetPaused',!remoteSceneReady||document.hidden); // Resume only after guest confirms the scene.
}
async function connected(){
 $('#pairing').hidden=true;$('#exchange').hidden=true;$('#game').hidden=false;$('#retry').hidden=true;document.body.dataset.screen='game';$('#game-feedback').append($('#feedback'));$('#left-you').hidden=role!=='host';$('#right-you').hidden=role!=='guest';
 $('#side').textContent=role==='host'?'You are LEFT · Host':'You are RIGHT · Guest';
 status('Connected. Initializing both arenas…');
 try{await loadPlayer();if(ended)return;await startRound(1);if(ended)return;poll=setInterval(tick,80);}catch(e){error(e.message);peer?.close();}
}
function setPeer(r){
 role=r;ended=false;
 peer=new Peer(role,{open:connected,error,message:onMessage,snapshot:onSnapshot,progress:status,code:code=>{ $('#outgoing').value=code;$('#outgoing-wrap').hidden=false;$('#exchange').removeAttribute('aria-busy');$('#step').textContent='Invite your friend';status('Room ready. Share this six-digit code and keep this tab open.'); }});
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
 if(type==='sceneReady'&&role==='host'&&data.round===round){remoteSceneReady=true;call('mpSetPaused',document.hidden);hostPaused=document.hidden;}
 if(type==='pause'&&role==='guest'){
  hostPaused=data.paused===true;pointer.ready=false;needLeave=true;
  $('#suspend').hidden=false;status(hostPaused?'Host tab is hidden. Duel paused.':'Host returned. Leave your chamber, then both ready again.');
 }
 if(type==='round'&&role==='guest'&&data.round===round)showState(data);
 if(type==='rematch'&&data.round===round){theirRematch=true;status('Your friend wants a rematch. Accept to play again.');maybeRematch();}
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
 lastSnapshot=s.tick;call('mpApply',s);showState(s);
}
async function tick(){
 if(ended||starting||busy)return;busy=true;
 try{
  if(role==='host'){
   if(Date.now()-lastRemote>1500)call('mpInput',1,0,0,false,false);
   call('mpInput',0,pointer.x,pointer.y,pointer.ready&&!hostPaused,pointer.fire&&!hostPaused);
   pointer.fire=false;
   const s=call('mpSnapshot');if(!s)return;s.round=round;showState(s);
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
$('#retry').onclick=()=>{peer?.close();location.reload();};
$('#leave').onclick=()=>{peer?.close();error('You left the duel. Retry to start a fresh session.');};
$('#rematch').onclick=()=>{myRematch=true;$('#rematch').disabled=true;$('#rematch').textContent='Rematch requested';peer.send('rematch',{round});status('Rematch requested. Waiting for your friend.');maybeRematch();};
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
 if(role==='host'&&player&&peer?.opened&&!ended){
  hostPaused=document.hidden;pointer.ready=false;pointer.fire=false;needLeave=true;
  // Pause the engine before suspending Ruffle, then restore only a readiness phase.
  if(document.hidden){call('mpSetPaused',true);player.pause();}
  else{player.play();call('mpSetPaused',false);}
  peer.send('pause',{paused:document.hidden,round});$('#suspend').hidden=false;
 }else if(role==='guest'&&peer?.opened){pointer.ready=false;peer.send('input',{...pointer,seq:seq++,round},'state');}
});
window.addEventListener('pagehide',()=>peer?.close());
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
