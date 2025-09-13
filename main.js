const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const prefersReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
const smoothBehavior=prefersReduced?'auto':'smooth';

const container=$('#snap');
const navEl=$('#primary-nav');
const navList=$('#primary-nav ul')||$('nav ul');
const menuBtn=$('#mobile-menu');
const ddParent=$('li.has-dropdown',navList);
const ddTrigger=ddParent?($(':scope > a',ddParent)||$(':scope > button',ddParent)):null;
const ddMenu=ddParent?$('.dropdown',ddParent):null;
let ddCloseTimer=null;

function setNavHeightVar(){
  const navH=navEl?Math.round(navEl.getBoundingClientRect().height):64;
  document.documentElement.style.setProperty('--nav-h',`${navH}px`);
}
window.addEventListener('load',setNavHeightVar);
window.addEventListener('resize',setNavHeightVar);

if(menuBtn&&navList){
  menuBtn.addEventListener('click',()=>{
    const expanded=menuBtn.getAttribute('aria-expanded')==='true';
    menuBtn.setAttribute('aria-expanded',String(!expanded));
    navList.classList.toggle('active');
    if(ddParent) ddParent.classList.remove('open');
  });
  navList.addEventListener('click',e=>{
    const a=e.target.closest('a');
    if(!a) return;
    const href=a.getAttribute('href')||'';
    if(href.startsWith('#')&&href.length>1){
      const target=$(href);
      if(target){
        e.preventDefault();
        target.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'});
        menuBtn.setAttribute('aria-expanded','false');
        navList.classList.remove('active');
      }
    }
  });
}

if(ddParent&&ddTrigger&&ddMenu){
  const isMobile=()=>window.matchMedia('(max-width: 768px)').matches;

  ddTrigger.addEventListener('click',e=>{
    if(isMobile()){
      e.preventDefault();
      ddParent.classList.toggle('open');
    }
  });

  ddParent.addEventListener('pointerenter',()=>{
    if(isMobile()) return;
    clearTimeout(ddCloseTimer);
    ddParent.classList.add('open');
  });
  ddParent.addEventListener('pointerleave',()=>{
    if(isMobile()) return;
    clearTimeout(ddCloseTimer);
    ddCloseTimer=setTimeout(()=>ddParent.classList.remove('open'),180);
  });

  document.addEventListener('click',e=>{
    if(!isMobile()) return;
    if(!ddParent.contains(e.target)) ddParent.classList.remove('open');
  });
}

if(navEl&&container){
  navEl.addEventListener('wheel',e=>{
    container.scrollBy({top:e.deltaY,left:0,behavior:'smooth'});
    e.preventDefault();
  },{passive:false});
}

$$('.experience-text .toggle').forEach(t=>{
  t.addEventListener('click',()=>{
    const li=t.closest('li');
    if(li) li.classList.toggle('active');
  });
});
$$('.project-header').forEach(h=>{
  h.addEventListener('click',()=>h.parentElement.classList.toggle('active'));
});

$$('.progress-circle').forEach(c=>{
  const v=c.querySelector('.progress-value');
  const p=Number(c.getAttribute('data-progress'))||0;
  const cl=clamp(p,0,100);
  if(v) v.textContent=`${cl}%`;
});

document.querySelectorAll('a[target="_blank"]').forEach(a=>{
  if(!a.rel.includes('noopener')) a.rel+=(a.rel?' ':'')+'noopener';
  if(!a.rel.includes('noreferrer')) a.rel+=' noreferrer';
});

function setActiveNavById(id){
  if(!navList||!id) return;
  navList.querySelectorAll('a[href^="#"]').forEach(a=>{
    const href=a.getAttribute('href')||'';
    a.classList.toggle('active',href===`#${id}`);
  });
}

if(container){
  const io=new IntersectionObserver(entries=>{
    let best=null;
    for(const en of entries){
      if(!best||en.intersectionRatio>best.intersectionRatio) best=en;
    }
    const id=best?.target?.id;
    if(id) setActiveNavById(id);
  },{root:container,threshold:[0.55,0.65,0.8]});
  $$('#snap > section',container).forEach(sec=>io.observe(sec));
}

window.addEventListener('hashchange',()=>{
  const id=location.hash||'';
  if(!id) return;
  const target=$(id);
  if(target) target.scrollIntoView({behavior:'smooth',block:'start',inline:'nearest'});
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(menuBtn&&navList.classList.contains('active')){
      navList.classList.remove('active');
      menuBtn.setAttribute('aria-expanded','false');
    }
    if(ddParent&&ddParent.classList.contains('open')) ddParent.classList.remove('open');
  }
});
