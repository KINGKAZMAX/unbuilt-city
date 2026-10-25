export class HUD {
  constructor(){this.hud=document.querySelector('#hud');this.obj=document.querySelector('#objective');}
  show(){this.hud.hidden=false;} hide(){this.hud.hidden=true;}
  setStars(){} setCash(){} setVitals(){}
  setWeapon(name){document.querySelector('#weapon').textContent=name?'身体模式 / 步行':'尺度模式 / 驾驶';}
  setSpeed(kmh){document.querySelector('#speed').innerHTML=`${Math.round(Math.abs(kmh))} <small>KM/H</small>`;}
  setClock(t){document.querySelector('#clock').textContent=t;}
  objective(title,text,frac=null){this.obj.hidden=!title;if(!title)return;this.obj.querySelector('.title').textContent=title;this.obj.querySelector('.text').textContent=text;const bar=this.obj.querySelector('.bar');bar.hidden=frac===null;if(frac!==null)bar.firstElementChild.style.width=`${Math.max(0,Math.min(1,frac))*100}%`;}
  banner(kind,text,sub=''){const b=document.querySelector('#banner');b.replaceChildren(document.createTextNode(text));if(sub){const s=document.createElement('small');s.textContent=sub;b.appendChild(s);}b.style.display='block';clearTimeout(this.bannerT);this.bannerT=setTimeout(()=>b.style.display='none',3000);}
  toast(text){const t=document.createElement('div');t.className='toast';t.textContent=text;const root=document.querySelector('#toasts');root.append(t);setTimeout(()=>t.remove(),3600);while(root.children.length>3)root.firstChild.remove();}
  hint(text){const e=document.querySelector('#hint');e.hidden=!text;e.textContent=text||'';}
  hurtFlash(){this.toast('碰撞后可继续探索；按 R 重新开始。');}
  fragments(ids){document.querySelectorAll('#fragment-list span').forEach((s,i)=>s.classList.toggle('done',i<ids.length));}
}
