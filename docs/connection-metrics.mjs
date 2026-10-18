// Local-only measurements. Nothing here is sent to analytics or a third party.
export class ConnectionMetrics {
 constructor(now=performance.now()){this.started=now;this.arrivals=[];this.renders=[];this.lastArrival=null;this.rtt=null;this.skipped=0;}
 receive(bytes,now=performance.now()){this.lastArrival=now;this.arrivals.push({now,bytes});this.trim(now);}
 render(ms,now=performance.now()){this.renders.push({now,ms});this.trim(now);}
 trim(now){this.arrivals=this.arrivals.filter(s=>s.now>now-5000);this.renders=this.renders.filter(s=>s.now>now-5000);}
 read(now=performance.now()){
  this.trim(now);const seconds=Math.max(.001,Math.min(5000,now-this.started)/1000);
  return {rttMs:this.rtt,incomingHz:this.arrivals.length/seconds,appliedHz:this.renders.length/seconds,kbps:this.arrivals.reduce((s,x)=>s+x.bytes,0)*8/seconds/1000,renderMs:this.renders.length?this.renders.reduce((s,x)=>s+x.ms,0)/this.renders.length:null,ageMs:this.lastArrival===null?null:now-this.lastArrival,skipped:this.skipped};
 }
}
export function connectionText(s){
 const delay=s.rttMs===null?'measuring…':Math.round(s.rttMs)+' ms';
 const draw=s.renderMs===null?'measuring…':s.renderMs.toFixed(1)+' ms';
 const stalled=s.ageMs!==null&&s.ageMs>2000?' Host updates have stalled.':'';
 return `Round trip: ${delay} · Host updates: ${s.incomingHz.toFixed(1)}/s · Update work: ${draw}.${stalled}`;
}
