// Test-only upload serialization. Native WebRTC still carries the delivered data.
// It is a synthetic application-layer link, not a physical-network measurement.
export function shapeNetwork(w,{kbps=256,delay=100,loss=.2,dropReferences=false}={}){
 const proto=w.RTCDataChannel.prototype,send=proto.send,buffered=Object.getOwnPropertyDescriptor(proto,'bufferedAmount').get;
 const queues=new WeakMap(),stats={maxQueuedBytes:0,maxQueueDelayMs:0,sent:0,lost:0,stateBytes:0,stateFrames:0,referencesDropped:0};let wireEnd=0;
 Object.defineProperty(proto,'bufferedAmount',{configurable:true,get(){return buffered.call(this)+(queues.get(this)||0);}});
 proto.send=function(data){
  if(dropReferences&&this.label==='control'&&typeof data!=='string'){stats.referencesDropped++;return;}
  const bytes=typeof data==='string'?new TextEncoder().encode(data).length:data.byteLength;
  const now=performance.now(),start=Math.max(now,wireEnd),finish=start+bytes*8/kbps;wireEnd=finish;queues.set(this,(queues.get(this)||0)+bytes);
  if(this.label==='state'){stats.stateFrames++;stats.stateBytes+=bytes;stats.maxQueuedBytes=Math.max(stats.maxQueuedBytes,queues.get(this));stats.maxQueueDelayMs=Math.max(stats.maxQueueDelayMs,start-now);}
  setTimeout(()=>{queues.set(this,queues.get(this)-bytes);setTimeout(()=>{if(this.readyState!=='open')return;if(this.label==='state'&&Math.random()<loss){stats.lost++;return;}stats.sent++;send.call(this,data);},delay);},finish-now);
 };
 return stats;
}
