export const VERSION=1, BUILD='gunblood-mp-1', TTL=10*60*1000;
const SESSION=/^[a-f0-9]{32}$/;
export function sessionId(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');}
export function encodeCode(type,session,sdp,now=Date.now()){
 return 'GB1.'+btoa(JSON.stringify({v:VERSION,build:BUILD,type,session,expires:now+TTL,sdp}));
}
export function decodeCode(text,type,session,now=Date.now()){
 if(typeof text!=='string'||text.length>100000||!text.trim().startsWith('GB1.'))throw Error('Invalid connection code. Paste the entire Gunblood code.');
 let c;try{c=JSON.parse(atob(text.trim().slice(4)));}catch{throw Error('Invalid connection code. Paste it again without edits.');}
 if(c.v!==VERSION||c.build!==BUILD)throw Error('Incompatible build. Both players must reload the same site.');
 if(c.type!==type)throw Error(`Expected an ${type} code. Check which player generated it.`);
 if(!SESSION.test(c.session)||session&&c.session!==session)throw Error('This code belongs to another session. Start a new pairing.');
 if(!Number.isFinite(c.expires)||c.expires<now||c.expires>now+TTL+60000)throw Error('Expired or invalid code. Generate a fresh offer. Check both device clocks.');
 if(typeof c.sdp!=='string'||c.sdp.length>60000||!c.sdp.startsWith('v=0\r\n')||!c.sdp.includes('m=application '))throw Error('Invalid WebRTC description. Generate a fresh code.');
 return c;
}
export function input(value){
 if(!value||!Number.isSafeInteger(value.seq)||value.seq<0||!Number.isFinite(value.x)||!Number.isFinite(value.y))return null;
 return {seq:value.seq,x:Math.max(0,Math.min(720,value.x)),y:Math.max(0,Math.min(425,value.y)),ready:value.ready===true,fire:value.fire===true};
}
export function winner(left,right,empty=false){return left<=0?(right<=0?'draw':'right'):right<=0?'left':empty?'draw':null;}
export const RELAY_ERROR='Direct connection failed. This network may require a relay, which this game does not use. Try another network, then Retry with fresh codes.';
