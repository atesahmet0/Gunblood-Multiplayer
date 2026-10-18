export const SNAPSHOT_CODEC='reference-frame-1';
// Patches always reference an acknowledged reliable keyframe, never another
// unreliable packet. Any individual state packet can be decoded after loss.
const properties=['n','d','f','x','y','sx','sy','r','a','v'];
export function referenceTreePatch(next,base){
 if(next===base)return null;
 if(!base)return {full:next};
 const patch={};for(const key of properties)if(next[key]!==base[key])patch[key]=next[key];
 const byName=new Map(base.c.map(c=>[c.n,c]));
 const children=next.c.map(c=>[c.n,referenceTreePatch(c,byName.get(c.n))]);
 if(next.c.length!==base.c.length||next.c.some((c,i)=>c.n!==base.c[i].n)||children.some(c=>c[1]!==null))patch.c=children;
 return Object.keys(patch).length?patch:null;
}
export function expandTree(base,patch){
 if(patch===null){if(!base)throw Error('Missing reference tree');return base;}
 if(!patch||typeof patch!=='object')throw Error('Invalid render tree');
 if(patch.full){if(!Array.isArray(patch.full.c))throw Error('Invalid render tree');return patch.full;}
 if(!base||patch.c&&!Array.isArray(patch.c))throw Error('Invalid render tree');
 const byName=new Map(base.c.map(c=>[c.n,c]));
 return {...base,...patch,c:patch.c?patch.c.map(pair=>{
  if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string')throw Error('Invalid render child');
  const child=expandTree(byName.get(pair[0]),pair[1]);if(child.n!==pair[0])throw Error('Invalid render name');return child;
 }):base.c};
}
export function referenceSnapshot(next,base){
 const patch={...next,tree:referenceTreePatch(next.tree,base.tree),bigText:referenceTreePatch(next.bigText,base.bigText)};
 for(const key of ['barrels','bars'])patch[key]=next[key].map((t,i)=>referenceTreePatch(t,base[key][i]));
 return patch;
}
export function expandSnapshot(base,patch){
 const s={...patch,tree:expandTree(base.tree,patch.tree),bigText:expandTree(base.bigText,patch.bigText)};
 for(const key of ['barrels','bars']){
  if(!Array.isArray(patch[key])||patch[key].length!==2)throw Error('Invalid render pair');
  s[key]=patch[key].map((t,i)=>expandTree(base[key][i],t));
 }
 delete s.delta;return s;
}
export class SnapshotReferences {
 constructor(){this.serial=0;this.pending=null;this.active=null;this.received=new Map();this.lastOffer=-Infinity;}
 propose(snapshot,now){
  if(this.pending?.snapshot.round===snapshot.round&&now-this.lastOffer<5000)return null;
  if(!this.pending&&this.active?.snapshot.round===snapshot.round&&now-this.lastOffer<5000)return null;
  this.pending={id:++this.serial,snapshot};this.lastOffer=now;return this.pending;
 }
 acknowledge(id){if(this.pending?.id!==id)return false;this.active=this.pending;this.pending=null;return true;}
 accept(id,snapshot){
  if(!Number.isSafeInteger(id)||id<1||!snapshot||snapshot.version!==1||!snapshot.tree||!Number.isSafeInteger(snapshot.round)||!Number.isSafeInteger(snapshot.tick))throw Error('Invalid reference frame');
  if(this.received.size&&id<=Math.max(...this.received.keys()))return false;
  this.received.set(id,snapshot);while(this.received.size>3)this.received.delete(this.received.keys().next().value);return true;
 }
 encode(snapshot){
  if(this.active?.snapshot.round!==snapshot.round)return snapshot;
  return {wire:SNAPSHOT_CODEC,base:this.active.id,frame:referenceSnapshot(snapshot,this.active.snapshot)};
 }
 decode(value){
  if(value?.wire!==SNAPSHOT_CODEC)return value;
  const base=this.received.get(value.base);if(!base)return null; // expired / not yet received; a later packet recovers
  if(value.frame?.round!==base.round)throw Error('Wrong reference round');
  return expandSnapshot(base,value.frame);
 }
}
export async function gzip(value){return new Response(new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();}
