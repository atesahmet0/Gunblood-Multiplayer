import {Peer} from './peer.mjs';
import {BUILD,input} from './protocol.mjs';
const $=s=>document.querySelector(s);
let remoteSceneReady=false;
let peer,role,player,poll,seq=0,lastAim=-1,lastFire=-1,round=1,lastSnapshot=-1,lastState='',myRematch=false,theirRematch=false,ended=false,busy=false,starting=false,lastRemote=0,hostPaused=false,needLeave=false;
let pointer={x:0,y:0,ready:false,fire:false};
function status(text,error=false){$('#status').textContent=text;$('#status').classList.toggle('error',error);}
function call(name,...args){return player?.ruffle().callExternalInterface(name,...args);}
function error(message){status(message,true);$('#retry').hidden=false;ended=true;clearInterval(poll);call('mpSetPaused',true);player?.pause();}
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
 $('#pairing').hidden=true;$('#exchange').hidden=true;$('#game').hidden=false;$('#retry').hidden=true;
 $('#side').textContent=role==='host'?'You are LEFT · Host':'You are RIGHT · Guest';
 status('Connected. Initializing both arenas…');
 try{await loadPlayer();if(ended)return;await startRound(1);if(ended)return;poll=setInterval(tick,80);}catch(e){error(e.message);peer?.close();}
}
function setPeer(r){
 role=r;ended=false;
 peer=new Peer(role,{open:connected,error,message:onMessage,snapshot:onSnapshot});
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
 $('#round').textContent=s.paused?'Paused':s.state==='finished'?(s.result==='draw'?'Draw':s.result==='left'?'Left wins':'Right wins'):s.state==='playing'?'FIRE!':s.state==='countdown'?String(3-Math.min(2,Math.floor(s.count/20))):`Ready: left ${s.ready?.[0]?'yes':'no'} · right ${s.ready?.[1]?'yes':'no'}`;
 $('#score').textContent=`Left: ${Math.max(0,Math.round(s.health[0]))} health · ${s.ammo[0]} shots     |     Right: ${Math.max(0,Math.round(s.health[1]))} health · ${s.ammo[1]} shots`;
 if(s.state==='finished'){$('#rematch').hidden=false;$('#rematch').textContent=theirRematch?'Accept rematch':'Request rematch';}
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
$('#host').onclick=()=>action(async()=>{
 $('#host').disabled=true;$('#join').disabled=true;setPeer('host');$('#exchange').hidden=false;$('#incoming').hidden=true;$('#incoming-label').hidden=true;$('#apply').hidden=true;
 $('#step').textContent='Send your offer';$('#instruction').textContent='Gathering connection routes. Your code will appear when this finishes.';status('Gathering ICE candidates…');
 const code=await peer.offer();$('#outgoing').value=code;$('#outgoing-wrap').hidden=false;$('#incoming').hidden=false;$('#incoming-label').hidden=false;$('#apply').hidden=false;
 $('#step').textContent='Send your offer, then paste the answer';$('#instruction').textContent='Your friend chooses Join Game and pastes your offer. Paste their answer below to connect.';$('#apply').textContent='Connect with answer';status('Offer ready. Waiting for your friend’s answer.');
});
$('#join').onclick=()=>{
 $('#host').disabled=true;$('#join').disabled=true;setPeer('guest');$('#exchange').hidden=false;$('#step').textContent='Paste the host’s offer';$('#instruction').textContent='Generate an answer and send it back to the host.';status('Waiting for an offer code.');
};
$('#apply').onclick=()=>action(async()=>{
 $('#apply').disabled=true;
 try{if(role==='guest'){status('Gathering ICE candidates…');const code=await peer.answer($('#incoming').value);$('#outgoing').value=code;$('#outgoing-wrap').hidden=false;$('#apply').hidden=true;status('Send your answer to the host. Keep this tab open.');}
 else{await peer.accept($('#incoming').value);status('Connecting directly…');$('#apply').hidden=true;}}
 finally{$('#apply').disabled=false;}
});
$('#copy').onclick=()=>action(async()=>{await navigator.clipboard.writeText($('#outgoing').value);status('Code copied. Send it privately to your friend.');});
$('#retry').onclick=()=>{peer?.close();location.reload();};
$('#leave').onclick=()=>{peer?.close();error('You left the duel. Retry to start a fresh session.');};
$('#rematch').onclick=()=>{myRematch=true;$('#rematch').disabled=true;peer.send('rematch',{round});status('Rematch requested. Waiting for your friend.');maybeRematch();};
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
