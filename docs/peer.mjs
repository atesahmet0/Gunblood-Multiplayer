import {BUILD,VERSION,sessionId,encodeCode,decodeCode,RELAY_ERROR} from './protocol.mjs';
export class Peer {
 constructor(role,events={}){
  this.role=role;this.events=events;this.session=role==='host'?sessionId():null;this.closed=false;this.opened=false;
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
  ch.onopen=()=>{if(this.control?.readyState==='open'&&this.state?.readyState==='open'&&!this.opened){this.opened=true;clearTimeout(this.connectTimer);this.send('hello',{build:BUILD,v:VERSION});this.events.open?.();}};
  ch.onmessage=e=>{if(this.closed)return;this.receive(ch.label,e.data).catch(()=>this.fail('Invalid peer data. The session has ended.'));};
  ch.onclose=()=>{if(!this.closed)this.fail('Peer left. The session has ended. Retry to start a new session.');};
  ch.onerror=()=>this.fail(this.opened?'Peer disconnected. The session has ended. Retry with fresh codes.':RELAY_ERROR);
 }
 async receive(channel,data){
  if(channel==='state'&&typeof data!=='string'){
   if(this.role!=='guest'||data.byteLength>60000)return;
   const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
   const reader=stream.getReader();let parts=[],size=0;
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('Snapshot too large');}parts.push(value);}
   this.events.snapshot?.(JSON.parse(await new Blob(parts).text()));return;
  }
  if(typeof data!=='string'||data.length>2000)return;
  const m=JSON.parse(data);
  if(m.session!==this.session||m.v!==VERSION)return;
  if(m.type==='hello'){if(m.data.build!==BUILD||m.data.v!==VERSION)this.fail('Incompatible build. Reload both browsers.');return;}
  if(m.type==='bye'){this.fail('Peer left. The session has ended.');return;}
  this.events.message?.(m.type,m.data,channel);
 }
 send(type,data={},channel='control'){
  const ch=this[channel];if(ch?.readyState!=='open'||ch.bufferedAmount>128000)return false;
  ch.send(JSON.stringify({v:VERSION,session:this.session,type,data}));return true;
 }
 async snapshot(s){
  if(this.packing||this.state?.readyState!=='open'||this.state.bufferedAmount>60000)return;
  this.packing=true;
  try{
   const bytes=await new Response(new Blob([JSON.stringify(s)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
   if(bytes.byteLength>60000)throw Error('Snapshot exceeds transport size');
   if(!this.closed&&this.state.readyState==='open')this.state.send(bytes);
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
 async offer(){await this.pc.setLocalDescription(await this.pc.createOffer());await this.gather();return encodeCode('offer',this.session,this.pc.localDescription.sdp);}
 async answer(text){const c=decodeCode(text,'offer');this.session=c.session;await this.pc.setRemoteDescription({type:'offer',sdp:c.sdp});await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gather();this.waitConnect();return encodeCode('answer',this.session,this.pc.localDescription.sdp);}
 async accept(text){if(this.pc.signalingState!=='have-local-offer')throw Error('This offer is no longer active. Retry with fresh codes.');const c=decodeCode(text,'answer',this.session);await this.pc.setRemoteDescription({type:'answer',sdp:c.sdp});this.waitConnect();}
 fail(message){if(this.closed)return;this.close();this.events.error?.(message);}
 close(){if(this.closed)return;this.send('bye');this.closed=true;clearTimeout(this.connectTimer);clearTimeout(this.disconnectTimer);this.control?.close();this.state?.close();this.pc.close();}
}
