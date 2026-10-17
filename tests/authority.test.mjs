import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const bridge=fs.readFileSync(new URL('../src/bridge.as',import.meta.url),'utf8').split('clearInterval(_root.mainint);')[0];
function world(role='host'){
 let shots=[0,0],physics=0;
 const c={_root:{mpRole:role,barrel1:{hitTest:()=>true},barrel2:{hitTest:()=>true},bigtext:{bigtextin:{},gotoAndPlay(){}},allsounds:Array.from({length:121},()=>({start(){}}))},
  mpSounds:[],mpSoundSerial:0,charshad:{},char2shad:{},mpInputs:[{x:0,y:0,ready:false},{x:0,y:0,ready:false}],mpPending:[false,false],mpPaused:false,mpCount:0,mpTickNumber:0,mpState:'waiting',char:{life:100,shotstaken:0},char2:{life:100,shotstaken:0},
  firePlayerShot(){shots[0]++;},Shoot2(){shots[1]++;},updateGameplay(){physics++;},Math,isNaN,localToGlobal(){},eval(){return {_x:0,_y:0};}};
 vm.createContext(c);vm.runInContext(bridge,c);c.mpAim=()=>{};c.mpExpire=()=>{};
 return {c,shots,get physics(){return physics;}};
}
test('guest cannot inject inputs or execute physics',()=>{let w=world('guest');assert.equal(w.c.mpInput(1,1,1,true,true),false);w.c.mpTick();assert.equal(w.physics,0);assert.equal(w.shots[1],0);});
test('waiting cannot fire; both readiness and full countdown required',()=>{let w=world();w.c.mpInput(1,0,0,false,true);w.c.mpTick();assert.equal(w.shots[1],0);assert.equal(w.physics,0);w.c.mpInputs.forEach(x=>x.ready=true);for(let n=0;n<59;n++)w.c.mpTick();assert.equal(w.c.mpState,'countdown');w.c.mpInputs[0].ready=false;w.c.mpTick();assert.equal(w.c.mpCount,0);assert.equal(w.c.mpState,'waiting');w.c.mpInputs[0].ready=true;for(let n=0;n<60;n++)w.c.mpTick();assert.equal(w.c.mpState,'playing');});
test('fire is latched across later aim updates; bursts coalesce per tick',()=>{let w=world();w.c.mpState='playing';for(let i=0;i<30;i++)w.c.mpInput(1,10,20,false,true);w.c.mpInput(1,30,40,false,false);w.c.mpTick();assert.equal(w.shots[1],1);w.c.mpTick();assert.equal(w.shots[1],1);});
test('both inputs run before damage resolution; simultaneous deaths draw',()=>{let w=world();w.c.mpState='playing';w.c.mpPending=[true,true];w.c.updateGameplay=()=>{assert.deepEqual(w.shots,[1,1]);w.c.char.life=0;w.c.char2.life=0;};w.c.mpTick();assert.equal(w.c.mpResult,'draw');assert.equal(w.c.mpState,'finished');});
test('wins and empty-ammo draw use host state',()=>{for(const [l,r,result] of [[0,100,'right'],[100,0,'left'],[100,100,'draw']]){let w=world();w.c.mpState='playing';w.c.char.life=l;w.c.char2.life=r;w.c.char.shotstaken=6;w.c.char2.shotstaken=6;w.c.mpTick();assert.equal(w.c.mpResult,result);}});
test('host suspension freezes tick and resets both readiness flags',()=>{let w=world();w.c.mpState='playing';w.c.mpInputs.forEach(x=>x.ready=true);w.c.mpSetPaused(true);w.c.mpTick();assert.equal(w.physics,0);assert.equal(w.c.mpState,'waiting');assert.ok(w.c.mpInputs.every(x=>!x.ready));w.c.mpSetPaused(false);w.c.mpTick();assert.equal(w.c.mpState,'waiting');});
