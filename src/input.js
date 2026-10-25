export class Input {
  constructor(canvas){
    this.canvas=canvas;this.held=new Set();this.pressed=new Set();this.mouseDX=0;this.mouseDY=0;this.locked=false;this.fireHeld=false;this.firePressed=false;this.drag=null;
    addEventListener('keydown',e=>{if(e.repeat)return;const k=normalizeKey(e);this.held.add(k);this.pressed.add(k);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
    addEventListener('keyup',e=>this.held.delete(normalizeKey(e)));addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
    addEventListener('mousemove',e=>{if(this.locked){this.mouseDX+=e.movementX;this.mouseDY+=e.movementY;}});
    canvas.addEventListener('pointerdown',e=>{if(this.locked)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(this.locked||this.drag?.id!==e.pointerId)return;this.mouseDX+=(e.clientX-this.drag.x)*.8;this.mouseDY+=(e.clientY-this.drag.y)*.8;this.drag.x=e.clientX;this.drag.y=e.clientY;});
    const release=()=>this.drag=null;canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===canvas;});
    document.querySelectorAll('[data-key]').forEach(btn=>{const key=btn.dataset.key;btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);this.held.add(key);this.pressed.add(key);});for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,()=>this.held.delete(key));});
  }
  lock(){if(this.locked||matchMedia('(pointer:coarse)').matches)return;try{this.canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}}
  clear(){this.held.clear();this.pressed.clear();this.drag=null;this.mouseDX=0;this.mouseDY=0;}
  consume(){this.pressed.clear();this.mouseDX=0;this.mouseDY=0;this.firePressed=false;}
  axis(neg,pos){return Number(this.held.has(pos))-Number(this.held.has(neg));}
}
function normalizeKey(e){const arrows={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};if(arrows[e.code])return arrows[e.code];if(/^Key[A-Z]$/.test(e.code))return e.code.slice(3).toLowerCase();return e.code;}
