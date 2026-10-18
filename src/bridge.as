// Multiplayer owns all input and scheduling. Guest applies display snapshots only.

function mpSound(index) {
   _root.allsounds[index].start();
   if(_root.mpRole == "host" && mpSounds != undefined) {
      mpSoundSerial++;
      mpSounds.push({seq:mpSoundSerial,id:index});
      if(mpSounds.length > 64) { mpSounds.shift(); }
   }
}
function mpInput(side,x,y,ready,fire) {
   if(_root.mpRole != "host" || (side != 0 && side != 1)) { return false; }
   if(isNaN(x) || isNaN(y)) { return false; }
   x = Math.max(0,Math.min(720,x));
   y = Math.max(0,Math.min(425,y));
   mpInputs[side] = {x:x,y:y,ready:ready == true,fire:false};
   if(fire == true) { mpPending[side] = true; }
   return true;
}
function mpAim(c,s,input) {
   var p = {x:input.x,y:input.y};
   c.globalToLocal(p);
   var off = c.pos == "standing" ? 0 : (c.pos == "leaning" ? 25 : (c.pos == "crouch" ? 50 : (c.pos == "dead" ? 125 : 100)));
   var angle = Math.atan2(p.y-off,p.x)*57;
   angle = Math.max(-90,Math.min(75,angle));
   if(c == char) {
      set("static",(angle+c.arm1._rotation-71.5)/57);
      ax = Math.cos(eval("static"));
      ay = Math.sin(eval("static"));
   }
   c.arm1.armin._rotation = angle-75;
   s.arm1.armin._rotation = angle-75;
   if(c._currentframe <= 100) { c.gotoAndStop(Math.max(1,Math.min(100,65-Math.ceil(angle)))); }
}
function mpReady(side) {
   var a = mpInputs[side];
   var barrel = side == 0 ? _root.barrel1 : _root.barrel2;
   return a.ready && barrel.hitTest(a.x,a.y,true);
}
function mpTick() {
   if(_root.mpRole != "host" || mpPaused) { return; }
   mpTickNumber++;
   if(mpState == "waiting" || mpState == "countdown") {
      if(mpReady(0) && mpReady(1)) {
         mpCount++;
         mpState = "countdown";
         if(mpCount % 20 == 1) { mpSound(120); }
         var n = 3-Math.floor(mpCount/20);
         _root.bigtext.bigtextin.countdown = Math.max(1,n);
         if(mpCount >= 60) {
            gameon = 1;
            mpState = "playing";
            _root.bigtext.bigtextin.countdown = "FIRE!";
            _root.bigtext.gotoAndPlay(2);
            mpSound(119);
         }
      } else {
         mpCount = 0;
         mpState = "waiting";
         _root.bigtext.bigtextin.countdown = "READY";
      }
   }
   if(mpState == "playing") {
      mpAim(char,charshad,mpInputs[0]);
      mpAim(char2,char2shad,mpInputs[1]);
      if(mpPending[0] && char.life > 0) { firePlayerShot(); }
      if(mpPending[1] && char2.life > 0) { Shoot2(); }
   }
   mpPending[0] = false;
   mpPending[1] = false;
   if(mpState == "playing" || mpState == "finished") {
      updateGameplay();
      mpExpire(char,eval("do "));
      mpExpire(char2,eval(",%"));
   }
   // Both projectile updates complete before deciding a winner.
   if(mpState == "playing") {
      if(char.life <= 0 || char2.life <= 0) {
         mpResult = char.life <= 0 ? (char2.life <= 0 ? "draw" : "right") : "left";
         mpState = "finished";
         char.shotgo=0; char2.shotgo=0;
         eval("do ")._visible=false; eval(",%")._visible=false;
         gameon = 0;
      } else if(char.shotstaken >= 6 && char2.shotstaken >= 6 && !char.shotgo && !char2.shotgo) {
         mpResult = "draw";
         mpState = "finished";
         char.shotgo=0; char2.shotgo=0;
         eval("do ")._visible=false; eval(",%")._visible=false;
         gameon = 0;
      }
   }
}
function mpExpire(c,b) {
   var p={x:b._x,y:b._y}; localToGlobal(p);
   if(p.x < -100 || p.x > 820 || p.y < -100 || p.y > 525) { c.shotgo=0; b._visible=false; }
}
function mpSetPaused(value) {
   mpPaused = value == true;
   if(mpPaused && mpState != "finished") {
      mpState = "waiting";
      mpCount = 0;
      gameon = 0;
      mpInputs[0].ready = false;
      mpInputs[1].ready = false;
      mpPending[0] = false;
      mpPending[1] = false;
   }
   return true;
}
function mpTree(mc,depth) {
   var r = {n:mc._name,d:mc.getDepth(),f:mc._currentframe,x:mc._x,y:mc._y,sx:mc._xscale,sy:mc._yscale,r:mc._rotation,a:mc._alpha,v:mc._visible,c:new Array()};
   if(depth > 8) { return r; }
   for(var k in mc) {
      var v = mc[k];
      // Particle pools contain many inactive clips. Visible effects remain
      // complete snapshots; absent dynamic clips are removed by mpApplyTree.
      if(typeof(v) == "movieclip" && v._parent == mc && (v._visible || mpLink(v._name) == "")) { r.c.push(mpTree(v,depth+1)); }
   }
   return r;
}
function mpSnapshot() {
   if(_root.mpRole != "host") { return null; }
   return {version:1,tick:mpTickNumber,state:mpState,count:mpCount,result:mpResult,paused:mpPaused,
      sounds:mpSounds,ready:new Array(mpReady(0),mpReady(1)),health:new Array(char.life,char2.life),ammo:new Array(6-char.shotstaken,6-char2.shotstaken),
      poses:new Array(char.pos,char2.pos),tree:mpTree(_root.scaleclip,0),
      barrels:new Array(mpTree(_root.barrel1,0),mpTree(_root.barrel2,0)),
      bars:new Array(mpTree(_root["switch"],0),mpTree(_root["extends"],0)),
      bigText:mpTree(_root.bigtext,0),text:_root.bigtext.bigtextin.countdown};
}
function mpLink(name) {
   if(name.indexOf("groundblood") == 0) { return "groundblood"; }
   if(name.indexOf("bmark") == 0) { return "bmark"; }
   if(name.indexOf("smoke") == 0) { return "smoke"; }
   if(name.indexOf("blood") == 0 && name != "bloodback") { return "blood"; }
   if(name.indexOf("cp") == 0) { return "bchunks"; }
   return "";
}
function mpApplyTree(mc,t,force) {
   if(!mc || !t) { return; }
   if(t == mc.__mpRender && !force && mc._currentframe == t.f) { return; }
   var last = force ? null : mc.__mpRender;
   var timelineChanged = mc._currentframe != t.f;
   if(!last) { mc.stop(); }
   // Re-entering unchanged timeline frames rebuilds nested display objects in Ruffle.
   if(timelineChanged) { mc.gotoAndStop(t.f); }
   if(!last || last.x != t.x) { mc._x=t.x; }
   if(!last || last.y != t.y) { mc._y=t.y; }
   if(!last || last.sx != t.sx) { mc._xscale=t.sx; }
   if(!last || last.sy != t.sy) { mc._yscale=t.sy; }
   if(!last || last.r != t.r) { mc._rotation=t.r; }
   if(!last || last.a != t.a) { mc._alpha=t.a; }
   if(!last || last.v != t.v) { mc._visible=t.v; }
   var changed = !last || last.f != t.f || last.c.length != t.c.length;
   if(!changed) {
      for(var j=0;j<t.c.length;j++) { if(last.c[j].n != t.c[j].n) { changed=true; break; } }
   }
   var seen;
   if(changed) { seen = new Object(); }
   for(var i=0;i<t.c.length;i++) {
      var child = t.c[i];
      if(changed) { seen[child.n] = true; }
      var target = mc[child.n];
      if(typeof(target) != "movieclip") {
         var link = mpLink(child.n);
         if(link != "") { target = mc.attachMovie(link,child.n,child.d); }
      }
      // A parent frame can re-place children with their original transforms.
      mpApplyTree(target,child,force || timelineChanged);
   }
   if(changed) {
      for(var k in mc) {
         var v = mc[k];
         if(typeof(v) == "movieclip" && v._parent == mc && !seen[v._name]) {
            if(mpLink(v._name) != "") { v.removeMovieClip(); }
         }
      }
   }
   mc.__mpRender=t;
}
function mpMergeTree(previous,patch) {
   if(patch == null) { return previous; }
   for(var i=0;i<patch.c.length;i++) { patch.c[i]=mpMergeTree(previous ? previous.c[i] : null,patch.c[i]); }
   return patch;
}
function mpHideLegacyOverlay() {
   // DefineSprite 538 contains the archived CHEATS ON timeline (text 537).
   _root[",\""]._visible=false;
   _root[",\""].stop();
}
function mpApply(s) {
   if(_root.mpRole != "guest" || s.version != 1 || s.tick <= mpTickNumber) { return false; }
   mpTickNumber = s.tick;
   if(s.delta == 1) {
      s.tree=mpMergeTree(mpRenderTree,s.tree);
      s.bigText=mpMergeTree(mpRenderText,s.bigText);
      for(var j=0;j<2;j++) {
         s.barrels[j]=mpMergeTree(mpRenderBarrels[j],s.barrels[j]);
         s.bars[j]=mpMergeTree(mpRenderBars[j],s.bars[j]);
      }
   }
   mpRenderTree=s.tree; mpRenderText=s.bigText; mpRenderBarrels=s.barrels; mpRenderBars=s.bars;
   mpApplyTree(_root.scaleclip,s.tree);
   mpApplyTree(_root.barrel1,s.barrels[0]); mpApplyTree(_root.barrel2,s.barrels[1]);
   mpApplyTree(_root["switch"],s.bars[0]); mpApplyTree(_root["extends"],s.bars[1]);
   mpApplyTree(_root.bigtext,s.bigText);
   if(_root.bigtext.bigtextin.countdown != s.text) { _root.bigtext.bigtextin.countdown = s.text; }
   mpHideLegacyOverlay();
   mpState=s.state; mpResult=s.result;
   for(var a=0;a<s.sounds.length;a++) {
      var event=s.sounds[a];
      if(event.seq > mpSoundSerial) { _root.allsounds[event.id].start(); mpSoundSerial=event.seq; }
   }
   char.life=s.health[0]; char2.life=s.health[1];
   char.shotstaken=6-s.ammo[0]; char2.shotstaken=6-s.ammo[1];
   char.pos=s.poses[0]; char2.pos=s.poses[1];
   return true;
}
function mpHead(c) { var p={x:0,y:0}; c.head.localToGlobal(p); return p; }
function mpInspect() {
   return {heads:new Array(mpHead(char),mpHead(char2)),role:_root.mpRole,state:mpState,tick:mpTickNumber,left:char.life,right:char2.life,
      legacyOverlayVisible:_root[",\""]._visible,legacyOverlayFrame:_root[",\""]._currentframe,
      paused:mpPaused,ready:new Array(mpReady(0),mpReady(1)),inputs:mpInputs,leftX:char._x,rightX:char2._x,children:mpTree(char,0).c.length};
}
clearInterval(_root.mainint);
setmouse = 0;
set("function",0);
_parent._xscale=100; _parent._yscale=100;
_root.pausebox._visible = false;
mpHideLegacyOverlay();
mpSounds = new Array();
mpSoundSerial = 0;
mpTickNumber = -1;
mpState = "waiting";
mpResult = "";
mpPaused = false;
mpCount = 0;
mpPending = new Array(false,false);
mpInputs = new Array({x:0,y:0,ready:false,fire:false},{x:0,y:0,ready:false,fire:false});
flash.external.ExternalInterface.addCallback("mpInput",this,mpInput);
flash.external.ExternalInterface.addCallback("mpSnapshot",this,mpSnapshot);
flash.external.ExternalInterface.addCallback("mpApply",this,mpApply);
flash.external.ExternalInterface.addCallback("mpInspect",this,mpInspect);
flash.external.ExternalInterface.addCallback("mpSetPaused",this,mpSetPaused);
if(_root.mpRole == "host") { _root.mainint = setInterval(mpTick,30); }
