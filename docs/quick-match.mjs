import {BUILD,VERSION,sessionId} from './protocol.mjs';
import {brokerOptions} from './lobby.mjs';
export const QUICK_SLOT='gunblood-quick-1-'+BUILD;
export const QUICK_TIMEOUT=120000;
const compatible=m=>m?.kind==='gunblood-quick-1'&&m.v===VERSION&&m.build===BUILD&&/^[a-f0-9]{32}$/.test(m.attempt||'');
// One waiting player owns the public slot. A committed pair forfeits its ID,
// retaining its open signaling channel, so a new pair can form independently.
export class QuickMatch {
 constructor(events={},Broker=globalThis.Peer,slot=QUICK_SLOT){this.slot=slot;this.events=events;this.Broker=Broker;this.state='idle';this.epoch=0;this.listeners=[];this.conn=null;this.broker=null;}
 start(){if(this.state!=='idle')return;this.deadline=Date.now()+QUICK_TIMEOUT;this.expiry=setTimeout(()=>this.fail('No match connected within two minutes. Try again or come back later.'),QUICK_TIMEOUT);this.state='searching';this.seek();}
 valid(epoch){return this.state==='searching'&&epoch===this.epoch;}
 listen(target,event,fn){target.on(event,fn);this.listeners.push(()=>target.off(event,fn));}
 clearListeners(){for(const off of this.listeners)off();this.listeners=[];}
 cleanup(){this.clearListeners();clearTimeout(this.stageTimer);clearTimeout(this.retryTimer);this.pending?.();this.pending=null;this.conn?.close();this.broker?.destroy();this.conn=null;this.broker=null;}
 async register(id,epoch){
  return new Promise((resolve,reject)=>{
   const b=this.broker=new this.Broker(id,brokerOptions());let opened=false;
   const timer=setTimeout(()=>reject(Error('PeerJS public signaling is unavailable. Try again in a moment.')),15000);
   this.pending=()=>{clearTimeout(timer);resolve(null);};
   this.listen(b,'open',()=>{opened=true;clearTimeout(timer);this.pending=null;resolve(b);});
   this.listen(b,'error',e=>{
    if(!this.valid(epoch))return;
    if(!opened){clearTimeout(timer);this.pending=null;reject(e);}
    else if(e.type==='peer-unavailable')this.resume('That player left. Finding another opponent…');
    else this.fail('PeerJS public signaling or the direct connection is unavailable. Try again. Some networks require a relay, which this game does not use.');
   });
   this.listen(b,'disconnected',()=>{if(opened&&this.valid(epoch))this.fail('Lost the matchmaking connection. Try again.');});
  });
 }
 async seek(){
  if(this.state!=='searching')return;
  const epoch=++this.epoch;this.attempt=sessionId();this.match=null;
  this.events.progress?.('Finding an opponent…');
  try{
   try{
    const b=await this.register(this.slot,epoch);if(!b||!this.valid(epoch))return;
    this.role='host';this.listen(b,'connection',c=>this.incoming(c,epoch));return;
   }catch(e){
    if(!this.valid(epoch))return;
    if(e.type!=='unavailable-id')throw e;
    this.cleanup();
   }
   const b=await this.register('gunblood-quick-guest-'+this.attempt,epoch);if(!b||!this.valid(epoch))return;
   this.role='guest';
   const c=this.conn=b.connect(this.slot,{reliable:true,serialization:'json',metadata:{kind:'gunblood-quick-1',v:VERSION,build:BUILD,attempt:this.attempt}});
   this.bind(c,epoch);
  }catch{if(this.valid(epoch))this.fail('PeerJS public signaling is unavailable. Try again in a moment.');}
 }
 incoming(c,epoch){
  if(!this.valid(epoch)){c.close();return;}
  const reject=type=>{const send=()=>{c.send({type});c.close();};if(c.open)send();else c.on('open',send);};
  if(!compatible(c.metadata)){reject('incompatible');return;}
  if(this.conn){reject('busy');return;}
  this.conn=c;this.attempt=c.metadata.attempt;this.match=sessionId();this.bind(c,epoch);
 }
 bind(c,epoch){
  this.stageTimer=setTimeout(()=>{if(this.valid(epoch))this.resume('Connection timed out. Finding another opponent…');},20000);
  const send=type=>c.send({type,attempt:this.attempt,match:this.match});
  this.listen(c,'open',()=>{if(this.valid(epoch)&&this.role==='host')send('reserved');});
  this.listen(c,'data',m=>{
   if(!this.valid(epoch))return;
   if(m?.type==='busy'){this.resume();return;}
   if(m?.type==='incompatible'){this.fail('Incompatible game build. Reload the site and try again.');return;}
   if(m?.attempt!==this.attempt||!/^[a-f0-9]{32}$/.test(m?.match||'')){this.resume();return;}
   if(this.role==='guest'&&m.type==='reserved'&&!this.match){this.match=m.match;send('accepted');}
   else if(this.role==='host'&&m.type==='accepted'&&m.match===this.match){send('committed');this.handoff();}
   else if(this.role==='guest'&&m.type==='committed'&&m.match===this.match)this.handoff();
   else this.resume();
  });
  this.listen(c,'close',()=>{if(this.valid(epoch))this.resume('That player left. Finding another opponent…');});
  this.listen(c,'error',()=>{if(this.valid(epoch))this.resume('Direct connection failed. Retrying; this network may require a relay.');});
 }
 handoff(){
  this.state='pairing';clearTimeout(this.stageTimer);this.clearListeners();
  const pair={role:this.role,broker:this.broker,connection:this.conn,attempt:this.attempt,match:this.match};
  this.broker=null;this.conn=null;
  // PeerJS disconnect releases the ID without closing existing data channels.
  pair.broker.disconnect();this.events.matched?.(pair);
 }
 resume(message='Finding an opponent…'){
  if(!['searching','pairing'].includes(this.state))return;
  this.state='searching';this.epoch++;this.cleanup();
  if(Date.now()>=this.deadline){this.fail('No match connected within two minutes. Try again or come back later.');return;}
  this.events.progress?.(message);
  this.retryTimer=setTimeout(()=>this.seek(),500+Math.floor(Math.random()*1000));
 }
 complete(){if(this.state!=='pairing')return;this.state='done';clearTimeout(this.expiry);}
 fail(message){if(['done','cancelled','failed'].includes(this.state))return;this.cancel();this.state='failed';this.events.error?.(message);}
 cancel(){this.state='cancelled';this.epoch++;clearTimeout(this.expiry);this.cleanup();}
}
