const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/* Measure nav height → --nav-h (helps when fonts change on mobile) */
const navEl=$('#primary-nav');
function setNavHeightVar(){
  const navH=navEl?Math.round(navEl.getBoundingClientRect().height):64;
  document.documentElement.style.setProperty('--nav-h',`${navH}px`);
}
window.addEventListener('load',setNavHeightVar);
window.addEventListener('resize',setNavHeightVar);

/* Mobile menu + dropdown */
const navList=$('#primary-nav ul')||$('nav ul');
const menuBtn=$('#mobile-menu');
const ddParent=navList?.querySelector('li.has-dropdown')||null;
const ddTrigger=ddParent?.querySelector(':scope > a, :scope > button')||null;

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

if(ddParent&&ddTrigger){
  const isMobile=()=>window.matchMedia('(max-width: 1023px)').matches;
  ddTrigger.addEventListener('click',e=>{
    if(isMobile()){
      e.preventDefault();
      ddParent.classList.toggle('open');
    }
  });
  document.addEventListener('click',e=>{
    if(!isMobile()) return;
    if(!ddParent.contains(e.target)) ddParent.classList.remove('open');
  });
}

/* Active section highlight — uses #snap for desktop, viewport for mobile */
const container=$('#snap');
let io=null;

function setupActiveSectionObserver(){
  if(io){ io.disconnect(); io=null; }

  const desktop=window.matchMedia('(min-width: 1024px)').matches;
  const root=desktop ? container : null; // container scroll on desktop; viewport on mobile
  if(!container) return;

  io=new IntersectionObserver(entries=>{
    // pick the most visible section
    let best=null;
    for(const en of entries){
      if(!best||en.intersectionRatio>best.intersectionRatio) best=en;
    }
    const id=best?.target?.id;
    if(!id) return;
    const navList=$('#primary-nav ul');
    if(!navList) return;
    navList.querySelectorAll('a[href^="#"]').forEach(a=>{
      const href=a.getAttribute('href')||'';
      a.classList.toggle('active',href===`#${id}`);
    });
  },{root,threshold:[0.5,0.65,0.8]});

  $$('#snap > section').forEach(sec=>io.observe(sec));
}
window.addEventListener('load',setupActiveSectionObserver);
window.matchMedia('(min-width: 1024px)').addEventListener('change',setupActiveSectionObserver);

/* Forward mousewheel from fixed nav to the correct scroller (desktop only) */
function bindNavWheelForwarder(){
  if(!navEl) return;
  const desktop=window.matchMedia('(min-width: 1024px)').matches;
  const handler=e=>{
    if(desktop && container){
      container.scrollBy({top:e.deltaY,left:0,behavior:'smooth'});
      e.preventDefault();
    }
  };
  // remove old listener if any
  navEl.onwheel=null;
  // add only for desktop
  if(desktop) navEl.addEventListener('wheel',handler,{passive:false});
}
window.addEventListener('load',bindNavWheelForwarder);
window.matchMedia('(min-width: 1024px)').addEventListener('change',bindNavWheelForwarder);

/* Expanding details */
$$('.experience-text .toggle').forEach(t=>{
  t.addEventListener('click',()=>t.closest('li')?.classList.toggle('active'));
});
$$('.project-header').forEach(h=>{
  h.addEventListener('click',()=>h.parentElement.classList.toggle('active'));
});

// Progress rings — set --p from data-progress (0–100)
// Progress rings — set --p from data-progress (0–100)
$$('.progress-circle').forEach(c=>{
  const v = c.querySelector('.progress-value');
  const p = Number(c.getAttribute('data-progress'));
  const cl = clamp(isFinite(p) ? p : 0, 0, 100);
  c.style.setProperty('--p', cl);
  if (v) v.textContent = `${cl}%`;
});


/* Safer rel for blank-target links */
document.querySelectorAll('a[target="_blank"]').forEach(a=>{
  if(!a.rel.includes('noopener')) a.rel+=(a.rel?' ':'')+'noopener';
  if(!a.rel.includes('noreferrer')) a.rel+=' noreferrer';
});

/* Close menus with Esc */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if(menuBtn&&navList?.classList.contains('active')){
    navList.classList.remove('active');
    menuBtn.setAttribute('aria-expanded','false');
  }
  if(ddParent?.classList.contains('open')) ddParent.classList.remove('open');
});
