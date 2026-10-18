import {BUILD,VERSION,TTL,sessionId} from './protocol.mjs';
export function roomCode(value){
 const code=String(value).trim();
 if(!/^\d{6}$/.test(code))throw Error('Enter the host’s six-digit code, including any leading zero.');
 return code;
}
export function randomCode(){
 const n=new Uint32Array(1);do{crypto.getRandomValues(n);}while(n[0]>=4294000000);
 return String(n[0]%1000000).padStart(6,'0');
}
export const brokerOptions=()=>({host:'0.peerjs.com',port:443,path:'/',key:'peerjs',secure:true,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]}});
const prefix='gunblood-mp1-';
const unavailable='PeerJS public signaling is unavailable. Retry in a moment. No game server is running.';
// PeerJS is used only to exchange validated native WebRTC descriptions. The
// existing control/state channels carry gameplay, with their original QoS.
export class Lobby {
 constructor(transport,events={},Broker=globalThis.Peer){this.transport=transport;this.events=events;this.Broker=Broker;this.closed=false;this.attempt=sessionId();}
 async start(code){
  this.code=code===undefined?randomCode():roomCode(code);
  const host=this.transport.role==='host';
  for(let tries=0;tries<8;tries++){
   try{await this.register(host?prefix+this.code:prefix+'guest-'+this.attempt);break;}
   catch(e){if(e.type==='unavailable-id'&&host&&tries<7){this.broker.destroy();this.code=randomCode();continue;}throw e;}
  }
  if(this.closed)return;
  this.expiry=setTimeout(()=>this.fail('This room expired. Retry to create a fresh six-digit code.'),TTL);
  if(host){this.broker.on('connection',c=>this.incoming(c));this.events.code?.(this.code);}
  else{
   this.conn=this.broker.connect(prefix+this.code,{reliable:true,serialization:'json',metadata:{kind:'gunblood-signaling-1',v:VERSION,build:BUILD,attempt:this.attempt}});
   this.bind(this.conn,false);
   this.connectTimer=setTimeout(()=>this.fail('No host answered that code. Check the code and ask the host to create a fresh room.'),25000);
  }
 }
 register(id){
  return new Promise((resolve,reject)=>{
   let ready=false;
   const broker=this.broker=new this.Broker(id,brokerOptions());
   const timer=setTimeout(()=>{if(!ready){broker.destroy();reject(Error(unavailable));}},15000);
   broker.on('open',()=>{ready=true;clearTimeout(timer);resolve();});
   broker.on('error',e=>{
    if(this.closed)return;
    if(!ready){clearTimeout(timer);reject(e.type==='unavailable-id'?e:Error(unavailable));}
    else if(e.type==='peer-unavailable')this.fail('No host has that code. Check it or ask for a fresh room.');
    else this.fail(unavailable);
   });
   broker.on('disconnected',()=>{if(ready&&!this.closed&&!this.transport.opened&&!this.exchanged)this.fail(unavailable);});
  });
 }
 incoming(c){
  const m=c.metadata;
  if(this.conn||!m||m.kind!=='gunblood-signaling-1'||m.v!==VERSION||m.build!==BUILD||!/^[a-f0-9]{32}$/.test(m.attempt||'')){
   c.on('open',()=>{c.send({type:'error',message:this.conn?'This room already has a guest. Ask for a new room.':'Incompatible game build. Reload both browsers.'});setTimeout(()=>c.close(),500);});return;
  }
  this.conn=c;this.attempt=m.attempt;this.bind(c,true);
 }
 adopt(pair){
  this.broker=pair.broker;this.attempt=pair.attempt;this.match=pair.match;this.conn=pair.connection;
  this.bind(this.conn,this.transport.role==='host',true);
 }
 bind(c,host,adopted=false){
  const run=fn=>Promise.resolve().then(fn).catch(e=>this.fail(e.message));
  const begin=()=>run(async()=>{
   if(this.closed)return;
   clearTimeout(this.connectTimer);
   this.connectTimer=setTimeout(()=>this.fail('Pairing timed out. This network may require a relay, which this game does not use. Retry or try another network.'),60000);
   this.events.progress?.(adopted?'Opponent found. Establishing your direct game connection…':'Friend found. Establishing your direct game connection…');
   if(adopted){this.phase=host?'ready':'offer';if(!host)c.send({type:'ready',attempt:this.attempt,match:this.match});}
   else if(host){this.phase='answer';c.send({type:'offer',attempt:this.attempt,code:await this.transport.offer()});}
   else this.phase='offer';
  });
  c.on('open',begin);
  c.on('data',m=>run(async()=>{
   if(this.closed)return;
   if(adopted&&host&&this.phase==='ready'&&m?.type==='ready'&&m.attempt===this.attempt&&m.match===this.match){this.phase='answer';c.send({type:'offer',attempt:this.attempt,code:await this.transport.offer()});return;}
   if(m?.type==='error'){this.fail(m.message==='This room already has a guest. Ask for a new room.'?m.message:'Incompatible game build. Reload both browsers.');return;}
   if(!m||m.attempt!==this.attempt||typeof m.code!=='string'||m.code.length>100000)throw Error('Invalid pairing response. Retry with a fresh room.');
   if(!host&&m.type==='offer'&&this.phase==='offer'){
    this.phase='connecting';const code=await this.transport.answer(m.code);c.send({type:'answer',attempt:this.attempt,code});this.exchanged=true;
   }else if(host&&m.type==='answer'&&this.phase==='answer'){
    this.phase='connecting';await this.transport.accept(m.code);this.exchanged=true;
   }else throw Error('Stale pairing response. Retry with a fresh room.');
  }));
  c.on('error',()=>{if(!this.exchanged)this.fail('Pairing connection failed. Retry with a fresh room.');});
  c.on('close',()=>{if(!this.closed&&!this.exchanged)this.fail('Host or guest left during pairing. Retry with a fresh room.');});
  if(adopted)begin();
 }
 fail(message){if(this.closed)return;this.close();this.transport.fail(message);}
 close(){if(this.closed)return;this.closed=true;clearTimeout(this.expiry);clearTimeout(this.connectTimer);this.conn?.close();this.broker?.destroy();}
}
