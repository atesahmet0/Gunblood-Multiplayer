"""Build from archived SWF. Requires Java 21+ and FFDec 26.3 (environment paths)."""
from pathlib import Path
import os, subprocess, struct, zlib, hashlib, json, re
R=Path(__file__).resolve().parents[1]
source=(R/'src/recovered-gameplay.as').read_text()
def replace_func(s,name,body):
 start=s.index('function '+name+'('); a=s.index('{',start); level=1; b=a+1
 while level:
  if s[b]=='{':level+=1
  if s[b]=='}':level-=1
  b+=1
 return s[:a+1]+'\n'+body+'\n'+s[b-1:]
source=re.sub(r'_root\.allsounds\[(.*?)\]\.start\(\);',r'mpSound(\1);',source)
source=replace_func(source,'updateOpponentAim','   return;')
source=replace_func(source,'updateCountdown','   return;')
source=replace_func(source,'finishRound','   return; // mpTick resolves both projectiles before the result.')
source=replace_func(source,'updatePlayerAim','   return; // Browser inputs only.')
source=source.replace('if(char.shotgo == 1)','if(char.shotgo == 1 && mpState == \"playing\")').replace('if(char2.shotgo == 1)','if(char2.shotgo == 1 && mpState == \"playing\")')
source=source.replace('char2.shotdelay = 8 + (7 - _root.gamelevel) + random(9 - _root.gamelevel);','char2.shotdelay = 8;')
source=source.replace('function updateGameplay()\n{','function updateGameplay()\n{\n   if(_root.mpRole != "host") { return; }\n   if(char2.shotdelay > 0) { char2.shotdelay -= 1; }')
source=source[:source.index('clearInterval(_root.mainint);',source.index('initializeRound();',source.index('this[')))]
source+='\n'+(R/'src/bridge.as').read_text()
(R/'build').mkdir(exist_ok=True)
(R/'build/gameplay.as').write_text(source)
bootstrap=(R/'src/bootstrap.as').read_text()+'\nfunction mpInitializeScene() {\n'+(R/'src/scene-setup.as').read_text()+'\nreturn allsounds;\n}\n'
(R/'build/bootstrap.as').write_text(bootstrap)
java=os.environ['JAVA_BIN']; jar=os.environ['FFDEC_JAR']
subprocess.run([java,'-Djava.awt.headless=true','-Duser.home='+str(R/'build/home'),'-Xmx2g','-Xss16m','-jar',jar,'-cli','-replace',str(R/'archive/gunblood.swf'),str(R/'build/compiled.swf'),'/frame_1/DoAction',str(R/'build/bootstrap.as'),'/DefineSprite_499/frame_1/DoAction[2]',str(R/'build/gameplay.as')],check=True)
# Guard every other timeline action in presentation mode, preserving original host bytecode.
# AVM1 Push '_root.mpRole'; GetVariable; Push 'guest'; Equals2; If(skip action).
def push(s):
 v=b'\x00'+s.encode()+b'\0';return b'\x96'+struct.pack('<H',len(v))+v
def guard(p):
 assert len(p)<32760
 return push('_root.mpRole')+b'\x1c'+push('guest')+b'\x49\x9d\x02\x00'+struct.pack('<h',len(p))+p+b'\0'
def tags(data):
 p=0
 while p<len(data):
  h=struct.unpack_from('<H',data,p)[0];p+=2;n=h&63;c=h>>6
  if n==63:n=struct.unpack_from('<I',data,p)[0];p+=4
  yield c,data[p:p+n];p+=n
def pack(c,p):return struct.pack('<HI',(c<<6)|63,len(p))+p
def skip_matrix(p,i):
 bit=i*8
 def read(n):
  nonlocal bit
  v=0
  for _ in range(n):v=(v<<1)|((p[bit//8]>>(7-bit%8))&1);bit+=1
  return v
 if read(1):read(read(5)*2)
 if read(1):read(read(5)*2)
 read(read(5)*2)
 return (bit+7)//8
def skip_color(p,i):
 bit=i*8
 def read(n):
  nonlocal bit
  v=0
  for _ in range(n):v=(v<<1)|((p[bit//8]>>(7-bit%8))&1);bit+=1
  return v
 add=read(1);mul=read(1);n=read(4);read((add+mul)*n*4)
 return (bit+7)//8
def clips(p,sprite):
 flags=p[0]
 if not(flags&128):return p
 i=3
 if flags&2:i+=2
 if flags&4:i=skip_matrix(p,i)
 if flags&8:i=skip_color(p,i)
 if flags&16:i+=2
 if flags&32:i=p.index(0,i)+1
 if flags&64:i+=2
 out=p[:i+6];i+=6
 while True:
  events=struct.unpack_from('<I',p,i)[0];i+=4
  out+=struct.pack('<I',events)
  if not events:break
  n=struct.unpack_from('<I',p,i)[0];i+=4
  body=p[i:i+n];i+=n
  key=body[:1] if events&0x20000 else b''
  action=body[len(key):]
  # The browser overlay is the sole local input path on the host too.
  if sprite==499 and events & (0x10|0x20|0x40):action=b'\0'
  else:action=guard(action)
  body=key+action;out+=struct.pack('<I',len(body))+body
 assert not any(p[i:]),(sprite,i,len(p))
 return out+p[i:]
def transform(data,sprite=0):
 out=b'';frame=1;action=0
 for c,p in tags(data):
  if c==1:frame+=1;action=0
  if c==39:p=p[:4]+transform(p[4:],struct.unpack_from('<H',p)[0])
  if c==26:p=clips(p,sprite)
  if c==12 and sprite==840:p=b"\x07\x00" # Intro must not return an active duel to the menu.
  if c==12:
   action+=1
   if not (sprite==0 and frame in [1,3,4]) and not(sprite==499 and frame==1 and action==2):p=guard(p)
  out+=pack(c,p)
 return out
b=(R/'build/compiled.swf').read_bytes();data=zlib.decompress(b[8:]) if b[:3]==b'CWS' else b[8:]
start=(5+4*(data[0]>>3)+7)//8+4
data=data[:start]+transform(data[start:]);out=b'CWS'+b[3:4]+struct.pack('<I',len(data)+8)+zlib.compress(data)
(R/'docs/gunblood-multiplayer.swf').write_bytes(out)
(R/'docs/build.json').write_text(json.dumps({'protocol':1,'build':'gunblood-mp-1','sha256':hashlib.sha256(out).hexdigest(),'archive_sha256':hashlib.sha256((R/'archive/gunblood.swf').read_bytes()).hexdigest()},indent=2)+'\n')
print('Built',len(out),'bytes')
