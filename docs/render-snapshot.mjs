// The wire always carries complete snapshots. Only the local Flash bridge uses
// patches, computed against the last successfully applied state (never packets
// that were dropped or replaced while decoding).
const props=['n','d','f','x','y','sx','sy','r','a','v'];
export function treePatch(next,previous){
 if(!previous)return next;
 if(next.c.length!==previous.c.length||next.c.some((c,i)=>c.n!==previous.c[i].n))return next;
 const children=next.c.map((c,i)=>treePatch(c,previous.c[i]));
 if(props.every(k=>next[k]===previous[k])&&children.every(c=>c===null))return null;
 return {...next,c:children};
}
export function bridgeSnapshot(next,previous){
 const patch={...next,delta:1,tree:treePatch(next.tree,previous?.tree),bigText:treePatch(next.bigText,previous?.bigText)};
 for(const key of ['barrels','bars'])patch[key]=next[key].map((t,i)=>treePatch(t,previous?.[key]?.[i]));
 return patch;
}
