// One decoder in flight and one replaceable waiting packet: slow clients cannot
// build an ever-growing gzip queue. Rendering likewise keeps only the newest frame.
export class LatestSnapshot {
 constructor(decode,deliver,onError){this.decode=decode;this.deliver=deliver;this.onError=onError;this.running=false;this.closed=false;this.pending=null;}
 push(data){if(this.closed)return;this.pending=data;if(!this.running)void this.drain();}
 async drain(){
  this.running=true;
  try{while(!this.closed&&this.pending!==null){const packet=this.pending;this.pending=null;const value=await this.decode(packet);if(!this.closed)this.deliver(value);}}
  catch(e){if(!this.closed)this.onError(e);}
  finally{this.running=false;}
 }
 close(){this.closed=true;this.pending=null;}
}
export function latestFrame(deliver,schedule=requestAnimationFrame,cancel=cancelAnimationFrame){
 let pending=null,frame=null,closed=false;
 return {push(value){if(closed)return;if(pending&&value.round===pending.round&&value.tick<=pending.tick)return;pending=value;if(frame===null)frame=schedule(()=>{frame=null;const value=pending;pending=null;if(!closed)deliver(value);});},close(){closed=true;pending=null;if(frame!==null)cancel(frame);frame=null;}};
}
