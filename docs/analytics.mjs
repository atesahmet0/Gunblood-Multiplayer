// Hosted anonymous analytics. Never send codes, peer IDs, inputs or render snapshots.
export function createRoundAnalytics(capture){
 const started=new Set(),finished=new Set();
 return (round,state)=>{
  if(state.state==='playing'&&!started.has(round)){
   started.add(round);capture('game_started',{is_rematch:round>1});
  }
  if(state.state==='finished'&&started.has(round)&&!finished.has(round)){
   finished.add(round);capture('game_completed',{is_rematch:round>1,result:state.result});
  }
 };
}

export function loadGoatCounter(account){
 return new Promise((resolve,reject)=>{
  const endpoint=`https://${account}.goatcounter.com/count`;
  window.goatcounter={no_onload:true,no_events:true,endpoint,path:'/Gunblood-Multiplayer/',referrer:''};
  const script=document.createElement('script');script.async=true;script.src='runtime/goatcounter.js';
  script.dataset.goatcounter=endpoint;
  script.onload=()=>typeof window.goatcounter?.count==='function'?resolve(vars=>window.goatcounter.count(vars)):reject(Error('Analytics unavailable'));
  script.onerror=()=>reject(Error('Analytics blocked'));
  document.head.append(script);
 });
}

export function createAnalytics({location,navigator,account,load=loadGoatCounter}){
 const allowed=location.hostname==='atesahmet0.github.io'&&['/Gunblood-Multiplayer/','/Gunblood-Multiplayer/index.html'].includes(location.pathname)&&!new URLSearchParams(location.search).has('test');
 if(!allowed||!account||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return ()=>{};
 let queue=[],send,failed=false;
 function deliver(vars){try{send(vars);}catch{}} // Analytics must never interrupt gameplay.
 try{
  Promise.resolve(load(account)).then(count=>{send=count;for(const vars of queue)deliver(vars);queue=[];},()=>{failed=true;queue=[];});
 }catch{failed=true;}
 function capture(path,title,event){
  if(failed)return;
  const vars={path,title,event,no_session:event,referrer:''};
  if(send)deliver(vars);else if(queue.length<32)queue.push(vars);
 }
 return (event,properties={})=>{
  if(event==='$pageview')capture('/Gunblood-Multiplayer/','Gunblood Multiplayer',false);
  if(event==='game_started'){
   capture('game_started','Games played',true);
   if(properties.is_rematch)capture('rematch_started','Rematches played',true);
  }
  if(event==='game_completed')capture('game_completed','Games completed',true);
 };
}
