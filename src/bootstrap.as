// Controlled bootstrap. Original root frame 11 still initializes sounds and ad hooks.

_root.mpRole = "pending";
_root.curchar = 2;
_root["break"] = "HIGH";
_root.use = 0;
function mpPrepare() { if(_root._framesloaded < _root._totalframes) { return false; } if(!_root.soundinit) { _root.allsounds=mpInitializeScene(); _root.soundinit=1; } return true; }
function mpPing() { return {loaded:_root._framesloaded,total:_root._totalframes,sound:_root.soundinit,ready:_root.soundinit == 1 && _root._framesloaded == _root._totalframes,build:"gunblood-mp-1",role:_root.mpRole,frame:_root._currentframe,scene:typeof(_root.scaleclip.mainclip)}; }
function mpStart(role) {
   if(!_root.soundinit || _root._framesloaded < _root._totalframes) { return false; }
   if(role != "host" && role != "guest") { return false; }
   clearInterval(_root.mainint);
   _root.mpRole = role;
   _root.gamelevel = 2;
   _root.bonuslevel = 0;
   _root.hitstaken = 0;
   _root.totalscore = 0;
   _root.sbloods = new Array();
   _root.sbloods2 = new Array();
   _root["["] = 0;
   _root["null "] = 0;
   _root.drawgame = 0;
   _root.levelout = 1;
   _root.gotoAndStop(4);
   return true;
}
flash.external.ExternalInterface.addCallback("mpPing",_root,mpPing);
flash.external.ExternalInterface.addCallback("mpPrepare",_root,mpPrepare);
flash.external.ExternalInterface.addCallback("mpStart",_root,mpStart);
_root.gotoAndStop(11);
