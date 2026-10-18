// Local Flash patches reference the last successfully applied state. The wire
// codec separately uses an acknowledged reference frame, so dropped network
// packets never become a dependency of later updates.
const props=['n','d','f','x','y','sx','sy','r','a','v'];
export function treePatch(next,previous){
 if(next===previous)return null;
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
