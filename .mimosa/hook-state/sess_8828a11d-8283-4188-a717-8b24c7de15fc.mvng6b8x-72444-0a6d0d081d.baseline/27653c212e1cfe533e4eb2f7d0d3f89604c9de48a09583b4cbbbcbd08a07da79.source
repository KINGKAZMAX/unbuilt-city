// Unbuilt Atlas — spatial score by Cai Zhixin, built on Overdrive City's MIT engine.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRNG } from './rng.js';
import { generateCity } from './city.js';
import { buildCityMeshes } from './citymesh.js';
import { DayNight } from './daynight.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Peds } from './peds.js';
import { Vehicle, resolveVehicleCollisions } from './vehicle.js';
import { Atlas } from './atlas.js';
import { preloadModels } from './assets.js';
import { initCharPicker } from './charpicker.js';

const $=s=>document.querySelector(s),STEP=1/60;
addEventListener('error',e=>{const el=$('#boot-status');if(el&&!el.hidden){el.textContent=`启动受阻：${e.message}`;}});
const canvas=$('#game');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}
catch(error){$('#boot-status').textContent='这个浏览器暂时无法启动 WebGL，请尝试支持三维加速的浏览器。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,900);
// Kenney CC0 载具/角色/树木先于城市构建就位；加载失败则保留程序化美术。
try{await preloadModels(n=>{$('#boot-status').textContent=`正在布置角色与车辆… ${n}`;});}catch{ /* fallback art */ }
const world={cfg:{...CONFIG,DAY_START:.74,DAY_LENGTH:900,TRAFFIC_MAX:14,PED_MAX:20},scene,camera,renderer,rng:makeRNG(CONFIG.SEED+1),state:'title',elapsed:0,manualClock:false,stats:{missions:0},cash:0,
  weapons:{key:'fist',weapon:{name:'观察者'}},police:{addHeat(){},cruisers:[]},events:{gunshot(){}},
  addCash(){},allVehicles(){return [...(world.traffic?.cars||[]),...(world.traffic?.parked||[])];},
  onDeath(){world.player.heal();world.hud.toast('身体已恢复，继续探索。');},
  onAtlasComplete(){world.state='complete';world.input.clear();document.exitPointerLock?.();$('#completion-time').textContent=`本次行走 ${Math.floor(world.elapsed/60)} 分 ${Math.floor(world.elapsed%60)} 秒`;$('#complete').hidden=false;$('#explore-btn').focus();world.audio.engine(0,false,false);}
};
world.city=generateCity(world.cfg);const cityMesh=buildCityMeshes(world.city);scene.add(cityMesh.group);
world.effects=new Effects(scene);world.audio=new AudioSys();world.input=new Input(canvas);world.hud=new HUD();world.minimap=new Minimap(world.city,$('#minimap'));world.daynight=new DayNight(scene,world.cfg);
world.player=new Player(world,world.city.spawn.x,world.city.spawn.z);world.player.camYaw=Math.PI;
world.traffic=new Traffic(world);world.peds=new Peds(world);world.missions=new Atlas(world);
// The exhibition is non-combat: collisions keep their physical feedback, without ending exploration.
world.player.damage=()=>{};
function placeExhibitionCar(){
 const t=world.missions.targets[0];const roads=world.city.roadTiles.map(([x,z])=>({x:(x+.5)*world.cfg.TILE,z:(z+.5)*world.cfg.TILE}));
 roads.sort((a,b)=>Math.hypot(a.x-t.x,a.z-t.z)-Math.hypot(b.x-t.x,b.z-t.z));
 const p=roads[0],lane=world.city.laneAt(p.x,p.z),head=[Math.PI/2,-Math.PI/2,0,Math.PI][lane]??Math.PI;
 const v=new Vehicle(world,'sports',p.x,p.z,head);v.color=0xff304a;v.bodyMat.color.setHex(v.color);(v.paintMats??[]).forEach(m=>m.color.setHex(v.color));v.keepAlive=true;v.damage=()=>{};
 world.traffic.parked.push(v);world.exhibitionCar=v;return v;
}
placeExhibitionCar();
initCharPicker({ onPick: key => {
  world.player.rebuild();
  if (world.state === 'play') world.hud.toast(`你已成为${({skid:'小学生',grandma:'奶奶',lady:'白领',courier:'外卖员',cashier:'收银员',guard:'保安',ceo:'总裁',corgi:'柯基',duck:'鸭子',fox:'狐狸',squirrel:'松鼠',koala:'考拉',chick:'小鸡',minionA:'小精灵·壹',minionB:'小精灵·贰',minionC:'小精灵·叁',minionD:'小精灵·肆'})[key] ?? key}。`);
}});
const headL=new THREE.SpotLight(0xffdadd,0,50,.48,.5,1.2),headR=headL.clone();scene.add(headL,headL.target,headR,headR.target);
function syncSound(){ $('#sound-btn').textContent=world.audio.muted?'声音 关':'声音 开';$('#sound-btn').setAttribute('aria-pressed',String(!world.audio.muted));}
syncSound();
function start(){world.audio.init();$('#title').hidden=true;$('#boot-status').hidden=true;world.hud.show();world.hud.setWeapon('观察者');world.state='play';world.input.clear();camera.position.set(world.player.pos.x,7,world.player.pos.z-11);camera.lookAt(world.player.pos.x,2,world.player.pos.z+10);world.hud.toast('向前进入红色装置。松开方向键，空间会记住你。');}
function pause(on){if(!['play','pause'].includes(world.state))return;world.state=on?'pause':'play';world.input.clear();$('#pause').hidden=!on;if(on){document.exitPointerLock?.();world.audio.engine(0,false,false);$('#resume-btn').focus();}else canvas.focus();}
function reset(){
 if(world.player.vehicle){world.player.vehicle.driver=null;world.player.vehicle=null;}
 for(const v of world.allVehicles())v.dispose();world.traffic=new Traffic(world);world.missions.reset();placeExhibitionCar();
 const p=world.player; p.pos.set(world.city.spawn.x,0,world.city.spawn.z);p.mesh.visible=true;p.mesh.position.copy(p.pos);p.camYaw=Math.PI;p.camPitch=.32;p.velX=p.velZ=0;p.heal();
 world.elapsed=0;world.input.clear();world.state='play';world.hud.show();world.hud.setWeapon('观察者');$('#pause').hidden=true;$('#complete').hidden=true;$('#banner').style.display='none';$('#toasts').replaceChildren();
 camera.position.set(p.pos.x,7,p.pos.z-11);world.daynight.update(0,p.pos);world.hud.toast('新一次行走，从身体开始。');
}
$('#start-btn').addEventListener('click',start);$('#pause-btn').addEventListener('click',()=>pause(true));$('#resume-btn').addEventListener('click',()=>pause(false));$('#restart-btn').addEventListener('click',reset);$('#again-btn').addEventListener('click',reset);
$('#explore-btn').addEventListener('click',()=>{$('#complete').hidden=true;world.state='play';world.input.clear();});
$('#sound-btn').addEventListener('click',()=>{world.audio.toggleMute();syncSound();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{world.hud.toast('可使用浏览器全屏，或在独立窗口打开。');}}
function handleKeys(){const p=world.input.pressed;if(p.has('Escape')||p.has('p'))pause(world.state==='play');if(p.has('f'))fullscreen();if(p.has('m')){world.audio.toggleMute();syncSound();}if(world.state!=='play')return;if(p.has('r'))reset();if(p.has('e')||p.has('Enter')){const before=world.player.vehicle;world.player.tryEnterExit();if(before&&world.player.vehicle)world.hud.toast('先减速到 29 km/h 以下，再按 E 下车。');else if(!before&&!world.player.vehicle)world.hud.toast('靠近一辆车，再按 E。红色跑车停在第一处装置附近。');}}
let lightT=0;
function update(dt){
 world.elapsed+=dt;world.player.camYaw+=(Number(world.input.held.has('q'))-Number(world.input.held.has('c')))*1.5*dt;
 world.player.update(dt);world.input.mouseDX=world.input.mouseDY=0;world.traffic.update(dt);
 for(const v of world.allVehicles())v.update(dt);resolveVehicleCollisions(world,world.allVehicles());
 if(world.player.vehicle)world.player.pos.copy(world.player.vehicle.pos);
 world.peds.update(dt);world.missions.update(dt);world.effects.update(dt);world.daynight.update(dt,world.player.pos);
 lightT-=dt;if(lightT<=0){lightT=.4;cityMesh.setNight(world.daynight.nightFactor);for(const v of world.allVehicles())if(!v.wrecked)v.setHeadlights(world.daynight.nightFactor>.25);}
 const pv=world.player.vehicle,beams=pv&&!pv.wrecked&&world.daynight.nightFactor>.25;headL.intensity=headR.intensity=beams?95:0;
 if(beams){const[fx,fz]=pv.fwd,rx=-fz,rz=fx;for(const [light,side]of[[headL,-.6],[headR,.6]]){light.position.set(pv.pos.x+fx*2+rx*side,.8,pv.pos.z+fz*2+rz*side);light.target.position.set(pv.pos.x+fx*30,.2,pv.pos.z+fz*30);}}
 world.audio.engine(pv?Math.min(1,pv.speed/pv.spec.maxF):0,!!pv?.controls.throttle,!!pv);
 world.hud.setSpeed(pv?pv.speed*3.6:0);world.hud.setClock(world.daynight.clockText());const state=world.missions.snapshot();world.hud.fragments(state.completedIds);
 $('#coordinates').textContent=`${world.player.pos.x.toFixed(1)} / ${world.player.pos.z.toFixed(1)}`;
 world.minimap.draw(world.player.pos.x,world.player.pos.z,world.player.camYaw+Math.PI,world.missions.blips());
 $('#compass').hidden=!state.target;if(state.target){const theta=Math.atan2(state.target.x-world.player.pos.x,state.target.z-world.player.pos.z)-(world.player.camYaw+Math.PI);$('#bearing').style.transform=`rotate(${-theta}rad)`;$('#target-distance').textContent=`${state.target.distance} M · ${state.target.title}`;}
 if(pv?.wrecked){pv.vx=pv.vz=0;world.player.tryEnterExit();world.hud.toast('这辆车已停驶，可换车或按 R 重新开始。');}
}
let last=performance.now(),acc=0,titleTime=0;
function render(){renderer.render(scene,camera);}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;if(!world.manualClock){handleKeys();if(world.state==='play'){acc+=dt;while(acc>=STEP&&world.state==='play'){update(STEP);acc-=STEP;}}else if(world.state==='title'){titleTime+=dt;const t=world.missions.targets[0],ang=.7+Math.sin(titleTime*.09)*.12;camera.position.set(t.x+Math.cos(ang)*43,29,t.z-Math.sin(ang)*43);camera.lookAt(t.x,8,t.z);world.missions.landmarks.update(dt,world.missions.snapshot().completedIds,0);world.daynight.update(0,{x:t.x,z:t.z});cityMesh.setNight(world.daynight.nightFactor);}world.input.consume();}render();}
requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
addEventListener('blur',()=>{if(world.state==='play')pause(true);});
window.render_game_to_text=()=>JSON.stringify({title:'未建之城 / Unbuilt Atlas',mode:world.state,coordinates:'meters; x east, z south; ground y=0',player:{x:+world.player.pos.x.toFixed(2),z:+world.player.pos.z.toFixed(2),mode:world.player.vehicle?'drive':'foot',heading:world.player.heading,speed:+(world.player.vehicle?.speed||Math.hypot(world.player.velX,world.player.velZ)).toFixed(2)},car:{x:world.exhibitionCar.pos.x,z:world.exhibitionCar.pos.z},atlas:world.missions.snapshot(),clock:world.daynight.clockText(),elapsed:+world.elapsed.toFixed(1)});
window.advanceTime=ms=>{world.manualClock=true;handleKeys();const count=Math.max(1,Math.round(ms/1000/STEP));for(let i=0;i<count&&world.state==='play';i++)update(STEP);world.input.consume();render();};
world.advance=(frames,before)=>{world.manualClock=true;for(let i=0;i<frames&&world.state==='play';i++){before?.();handleKeys();update(STEP);world.input.consume();}render();};
world.reset=reset;world.pause=pause;world.start=start;window.__oc=world;
$('#start-btn').disabled=false;$('#start-btn span').textContent=world.missions.snapshot().completedIds.length?'继续这次行走':'进入未建之城';$('#boot-status').hidden=true;
