import {SnapshotReferences,SNAPSHOT_CODEC,gzip} from './snapshot-codec.mjs';
import {ConnectionMetrics} from './connection-metrics.mjs';
import {LatestSnapshot,latestFrame} from './latest-snapshot.mjs';
import {Lobby} from './lobby.mjs';
import {BUILD,VERSION,sessionId,encodeCode,decodeCode,RELAY_ERROR} from './protocol.mjs';
export class Peer {
 constructor(role,events={}){
  this.role=role;this.events=events;this.metrics=new ConnectionMetrics();this.probeSerial=0;this.references=new SnapshotReferences();this.compact=false;
  this.renderFrames=latestFrame(s=>{try{this.events.snapshot?.(s);}catch{this.fail('Could not render peer state. Retry the duel.');}});
  this.referencePackets=new LatestSnapshot(data=>this.decodeSnapshot(data),m=>{if(m.wire===SNAPSHOT_CODEC&&m.session===this.session&&this.references.accept(m.base,m.snapshot))this.send('referenceReady',{base:m.base});},()=>this.fail('Invalid reference frame. The session has ended.'));
  this.snapshots=new LatestSnapshot(data=>this.decodeSnapshot(data),s=>{const value=this.references.decode(s);if(value)this.renderFrames.push(value);},()=>this.fail('Invalid peer data. The session has ended.'));
  this.session=role==='host'?sessionId():null;this.closed=false;this.opened=false;
  this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
  this.pc.onconnectionstatechange=()=>{
   const s=this.pc.connectionState;
   if(s==='failed')this.fail(this.opened?'Peer disconnected. The session has ended. Retry with fresh codes.':RELAY_ERROR);
   if(s==='disconnected')this.disconnectTimer=setTimeout(()=>this.fail('Peer disconnected. The session has ended. Retry to pair again.'),5000);
   if(s==='connected')clearTimeout(this.disconnectTimer);
  };
  if(role==='host'){
   this.bind(this.pc.createDataChannel('control',{ordered:true}));
   this.bind(this.pc.createDataChannel('state',{ordered:false,maxRetransmits:0}));
  }else this.pc.ondatachannel=e=>this.bind(e.channel);
 }
 bind(ch){
  if(!['control','state'].includes(ch.label)||this[ch.label]){ch.close();return;}
  this[ch.label]=ch;ch.binaryType='arraybuffer';
  ch.onopen=()=>{if(this.control?.readyState==='open'&&this.state?.readyState==='open'&&!this.opened){this.opened=true;this.metrics=new ConnectionMetrics();this.lobby?.close();clearTimeout(this.connectTimer);this.send('hello',{build:BUILD,v:VERSION,snapshots:SNAPSHOT_CODEC});this.events.open?.();this.probeTimer=setInterval(()=>this.probe(),2000);this.probe();}};
  ch.onmessage=e=>{if(this.closed)return;this.receive(ch.label,e.data).catch(()=>this.fail('Invalid peer data. The session has ended.'));};
  ch.onclose=()=>{if(!this.closed)this.fail('Peer left. The session has ended. Retry to start a new session.');};
  ch.onerror=()=>this.fail(this.opened?'Peer disconnected. The session has ended. Retry with fresh codes.':RELAY_ERROR);
 }
 async receive(channel,data){
  if(channel==='control'&&typeof data!=='string'){
   if(this.role!=='guest'||data.byteLength>60000)return;
   this.referencePackets.push(data);
   return;
  }
  if(channel==='state'&&typeof data!=='string'){
   if(this.role!=='guest'||data.byteLength>60000)return;
   this.metrics.receive(data.byteLength);this.snapshots.push(data);return;
  }
  if(typeof data!=='string'||data.length>2000)return;
  const m=JSON.parse(data);
  if(m.session!==this.session||m.v!==VERSION)return;
  if(m.type==='hello'){if(m.data.build!==BUILD||m.data.v!==VERSION)this.fail('Incompatible build. Reload both browsers.');else this.compact=m.data.snapshots===SNAPSHOT_CODEC;return;}
  if(m.type==='referenceReady'){if(this.role==='host')this.references.acknowledge(m.data?.base);return;}
  if(m.type==='ping'){if(Number.isSafeInteger(m.data?.id))this.send('pong',{id:m.data.id});return;}
  if(m.type==='pong'){if(this.pendingProbe&&m.data?.id===this.pendingProbe.id){this.metrics.rtt=performance.now()-this.pendingProbe.time;this.pendingProbe=null;}return;}
  if(m.type==='bye'){this.fail('Peer left. The session has ended.');return;}
  this.events.message?.(m.type,m.data,channel);
 }
 probe(){if(this.closed)return;this.pendingProbe={id:++this.probeSerial,time:performance.now()};this.send('ping',{id:this.pendingProbe.id});}
 async decodeSnapshot(data){
  const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let parts=[],size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('Snapshot too large');}parts.push(value);}
  return JSON.parse(await new Blob(parts).text());
 }
 send(type,data={},channel='control'){
  const ch=this[channel];if(ch?.readyState!=='open'||(channel==='state'?ch.bufferedAmount>0:ch.bufferedAmount>128000))return false;
  ch.send(JSON.stringify({v:VERSION,session:this.session,type,data}));return true;
 }
 async snapshot(s){
  if(this.packing||this.state?.readyState!=='open')return;
  if(this.state.bufferedAmount>0){if(this.metrics)this.metrics.skipped++;return;}
  this.packing=true;
  try{
   if(this.compact&&this.control?.readyState==='open'&&this.control.bufferedAmount===0){
    const base=this.references.propose(s,performance.now());
    if(base){
     const packet=await gzip({wire:SNAPSHOT_CODEC,session:this.session,base:base.id,snapshot:base.snapshot});
     if(packet.byteLength>60000)throw Error('Reference frame exceeds transport size');
     if(!this.closed&&this.control.readyState==='open'&&this.control.bufferedAmount===0)this.control.send(packet);
     else{this.references.pending=null;this.references.lastOffer=-Infinity;}
    }
   }
   const bytes=await gzip(this.compact?this.references.encode(s):s);
   if(bytes.byteLength>60000)throw Error('Snapshot exceeds transport size');
   // Compression is asynchronous: recheck congestion immediately before send.
   if(!this.closed&&this.state.readyState==='open'&&this.state.bufferedAmount===0)this.state.send(bytes);
  }finally{this.packing=false;}
 }
 async gather(){
  if(this.pc.iceGatheringState==='complete')return;
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('ICE gathering timed out. Retry on another network.'));},45000);
   const listener=()=>{if(this.pc.iceGatheringState==='complete'){cleanup();resolve();}};
   const cleanup=()=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',listener);};
   this.pc.addEventListener('icegatheringstatechange',listener);listener();
  });
 }
 waitConnect(){clearTimeout(this.connectTimer);this.connectTimer=setTimeout(()=>this.fail(RELAY_ERROR),45000);}
 adoptQuickMatch(pair){this.lobby=new Lobby(this,this.events);this.lobby.adopt(pair);}
 async host(){this.lobby=new Lobby(this,this.events);await this.lobby.start();}
 async join(code){this.lobby=new Lobby(this,this.events);await this.lobby.start(code);}
 async offer(){await this.pc.setLocalDescription(await this.pc.createOffer());await this.gather();return encodeCode('offer',this.session,this.pc.localDescription.sdp);}
 async answer(text){const c=decodeCode(text,'offer');this.session=c.session;await this.pc.setRemoteDescription({type:'offer',sdp:c.sdp});await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gather();this.waitConnect();return encodeCode('answer',this.session,this.pc.localDescription.sdp);}
 async accept(text){if(this.pc.signalingState!=='have-local-offer')throw Error('This offer is no longer active. Retry with fresh codes.');const c=decodeCode(text,'answer',this.session);await this.pc.setRemoteDescription({type:'answer',sdp:c.sdp});this.waitConnect();}
 fail(message){if(this.closed)return;this.close();this.events.error?.(message);}
 close(){if(this.closed)return;this.send('bye');this.closed=true;clearInterval(this.probeTimer);this.referencePackets.close();this.snapshots.close();this.renderFrames.close();this.lobby?.close();clearTimeout(this.connectTimer);clearTimeout(this.disconnectTimer);this.control?.close();this.state?.close();this.pc.close();}
}
