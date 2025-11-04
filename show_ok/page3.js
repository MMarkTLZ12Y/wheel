// ===== LocalStorage kulcsok (v3 – robusztus aláírás) =====
const KEY_ITEMS    = 'kerdesek';
const KEY_ORDER    = 'kerdesek_order_v3';
const KEY_SIG      = 'kerdesek_sig_v3';
const KEY_PROGRESS = 'kerdesek_progress_v3';

// ===== Beállítások =====
const SLICE_COUNT  = 18;    // 15 kérdés + 3 extra
const NORMAL_COUNT = 15;

const MIN_TURNS = 5;
const MAX_TURNS = 9;
const MIN_DUR_MS = 6000;
const MAX_DUR_MS = 9000;

// ===== Állapot =====
let items = [];              // 18 elem
let order = [];              // permutáció: wheelIndex -> originalIndex
let spinning = false;
let lockedAfterSpin = false;
let currentRotation = 0;
let nextOriginalIndex = 0;   // 0..17 – „kamu” sorrend
let modalOpen = false;

// ===== Util =====
function deg2rad(d){return d*Math.PI/180;}
function polarToXY(cx,cy,r,deg){const a=deg2rad(deg);return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
function normalizeDeg(d){let x=d%360; if(x<0)x+=360; return x;}

// ----- Kérdések betöltése (18 elem) -----
function loadItems(){
  const raw = JSON.parse(localStorage.getItem(KEY_ITEMS) || '[]');
  items = Array.from({length: SLICE_COUNT}, (_,i)=>{
    const t = (raw[i] || '').trim();
    if (!t) return (i>=NORMAL_COUNT) ? '?' : `(${i+1}. üres)`;
    return t;
  });
}

// Robusztus aláírás: teljes JSON
function getSignature(arr){ return JSON.stringify(arr); }

function isPermutation(a,n){
  if(!Array.isArray(a)||a.length!==n) return false;
  const set=new Set(a);
  if(set.size!==n) return false;
  for(let i=0;i<n;i++) if(!set.has(i)) return false;
  return true;
}
function shuffle(n){
  const a=Array.from({length:n},(_,i)=>i);
  for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];}
  return a;
}

// ----- Véletlen keréksorrend + „kamu” haladás kezelése -----
function loadOrInitOrderAndProgress(){
  const sig = getSignature(items);
  const oldSig = localStorage.getItem(KEY_SIG);

  if (oldSig !== sig) {
    order = shuffle(SLICE_COUNT);
    localStorage.setItem(KEY_ORDER, JSON.stringify(order));
    localStorage.setItem(KEY_SIG, sig);
    nextOriginalIndex = 0;
    localStorage.setItem(KEY_PROGRESS, String(nextOriginalIndex));
    return;
  }

  try{
    const saved = JSON.parse(localStorage.getItem(KEY_ORDER) || '[]');
    order = isPermutation(saved, SLICE_COUNT) ? saved : shuffle(SLICE_COUNT);
    localStorage.setItem(KEY_ORDER, JSON.stringify(order));
  }catch{
    order = shuffle(SLICE_COUNT);
    localStorage.setItem(KEY_ORDER, JSON.stringify(order));
  }

  const p = parseInt(localStorage.getItem(KEY_PROGRESS) || '0', 10);
  nextOriginalIndex = isFinite(p) ? ((p%SLICE_COUNT)+SLICE_COUNT)%SLICE_COUNT : 0;
}

// ----- Felső kis doboz + modál -----
function updateResultBox(text){
  const box=document.getElementById('resultBox');
  box.innerHTML='';
  const p=document.createElement('p');
  p.className='result-text';
  p.textContent=text;
  box.appendChild(p);
}
function setHint(text){
  const box=document.getElementById('resultBox');
  const span=document.createElement('span');
  span.className='muted';
  span.textContent=text;
  box.appendChild(span);
}

// MODÁL / POPUP
function showModal(text){
  const bd = document.getElementById('modalBackdrop');
  const t  = document.getElementById('modalText');
  t.textContent = text;
  bd.classList.add('show');
  bd.setAttribute('aria-hidden','false');
  modalOpen = true;
}
function hideModal(){
  const bd = document.getElementById('modalBackdrop');
  bd.classList.remove('show');
  bd.setAttribute('aria-hidden','true');
  modalOpen = false;
}

// ----- Igazítás a pointerhez + pörgés -----
function computeExtraRotationToAlign(centerAngle,currentRot){
  const targetAt=270; // pointer felül
  const nowAt=normalizeDeg(centerAngle+currentRot);
  return normalizeDeg(targetAt - nowAt);
}
function randomDuration(){
  return Math.floor(Math.random()*(MAX_DUR_MS-MIN_DUR_MS+1))+MIN_DUR_MS;
}
function spinToWheelIndex(wheelIndex,wrapEl,durationMs){
  const slice=360/SLICE_COUNT;
  const centerAngle=wheelIndex*slice+slice/2;
  const turns=Math.floor(Math.random()*(MAX_TURNS-MIN_TURNS+1))+MIN_TURNS;
  const extraAlign=computeExtraRotationToAlign(centerAngle,currentRotation);
  const extraTotal=turns*360+extraAlign;
  currentRotation+=extraTotal;
  wrapEl.style.transition=`transform ${durationMs}ms cubic-bezier(0.08, 0.86, 0.25, 1)`;
  wrapEl.style.transform=`rotate(${currentRotation}deg)`;
}

// ----- Címke vágás (24 karakter, egész szavak; ha vág → „…”) -----
function formatLabel24(s){
  s=(s||'').trim().replace(/\s+/g,' ');
  if(s==='?') return '?';
  if(s.length<=24) return s;

  const words=s.split(' ');
  let out='', truncated=false;
  for(let i=0;i<words.length;i++){
    const w=words[i];
    if(!out){
      if(w.length>24){ out=w.slice(0,24); truncated=true; break; }
      out=w;
    }else{
      if(out.length+1+w.length<=24) out+=' '+w;
      else{ truncated=true; break; }
    }
  }
  if(truncated) out+='…';
  return out;
}

// vászon szélességméréshez
const _measureCanvas=document.createElement('canvas');
const _ctx=_measureCanvas.getContext('2d');
function textWidthPx(text, fontSizePx, fontFamily='600 12px system-ui, Arial, sans-serif'){
  const fam=fontFamily.replace(/\d+px/, fontSizePx+'px');
  _ctx.font=fam;
  return _ctx.measureText(text).width;
}
function bestFontSizeThatFits(text, maxW, minPx=10, maxPx=16, fontFamily='600 12px system-ui, Arial, sans-serif'){
  let lo=minPx, hi=maxPx, ans=minPx;
  while(lo<=hi){
    const mid=Math.floor((lo+hi)/2);
    const w=textWidthPx(text, mid, fontFamily);
    if(w<=maxW){ ans=mid; lo=mid+1; } else { hi=mid-1; }
  }
  return ans;
}

// ===== Kerék (SVG) – SZÍNEZÉS/„?” az EREDETI index alapján =====
function createWheelSVG(itemsArr, orderArr){
  const size=520, r=250;
  const cx=size/2, cy=size/2;
  const sliceDeg=360/orderArr.length;
  const svgNS='http://www.w3.org/2000/svg';
  const xhtmlNS='http://www.w3.org/1999/xhtml';

  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
  svg.setAttribute('width',size);
  svg.setAttribute('height',size);
  svg.classList.add('wheel-svg');

  // perem
  const bg=document.createElementNS(svgNS,'circle');
  bg.setAttribute('cx',cx); bg.setAttribute('cy',cy); bg.setAttribute('r',r+6);
  bg.setAttribute('class','wheel-bg');
  svg.appendChild(bg);

  for(let i=0;i<orderArr.length;i++){
    const originalIndex = orderArr[i];          // <<< EREDETI index
    const isExtra = originalIndex >= NORMAL_COUNT;

    const start=i*sliceDeg, end=start+sliceDeg;
    const [x1,y1]=polarToXY(cx,cy,r,start);
    const [x2,y2]=polarToXY(cx,cy,r,end);

    const path=document.createElementNS(svgNS,'path');
    path.setAttribute('d',[
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 0 1 ${x2} ${y2}`,
      'Z'
    ].join(' '));
    // SZÍN/„?”: EREDETI index alapján!
    if(isExtra){ path.setAttribute('fill','#FFD93D'); }
    else { path.setAttribute('fill', i%2 ? '#5cb6ff' : '#7cc7ff'); }
    path.setAttribute('stroke','#ffffff');
    svg.appendChild(path);

    // ---- Felirat sugárirányban (origóból kifelé) ----
    const centerAngle = start + sliceDeg/2;
    const innerR = r * 0.38;
    const outerR = r * 0.92;
    const labelW = Math.max(100, outerR - innerR);
    const labelH = 24;

    const g=document.createElementNS(svgNS,'g');
    g.setAttribute('transform',`rotate(${centerAngle} ${cx} ${cy})`);

    const fo=document.createElementNS(svgNS,'foreignObject');
    fo.setAttribute('x',(cx + innerR).toFixed(1));
    fo.setAttribute('y',(cy - labelH/2).toFixed(1));
    fo.setAttribute('width',labelW.toFixed(1));
    fo.setAttribute('height',labelH);

    const div=document.createElementNS(xhtmlNS,'div');
    div.setAttribute('class','slice-label');
    div.style.padding='0 4px';
    div.style.fontWeight='700';

    if(isExtra){
      div.style.fontSize='18px';
      div.style.textAlign='center';
      div.textContent='?';                        // <<< csak „?” a keréken
    }else{
      const full = itemsArr[originalIndex];
      const clipped = formatLabel24(full);
      const best = bestFontSizeThatFits(clipped, labelW-8, 10, 16);
      div.style.fontSize = best + 'px';
      div.style.textAlign='left';
      div.textContent = clipped;                  // <<< normál címke
      div.setAttribute('title', full);
    }

    fo.appendChild(div);
    g.appendChild(fo);
    svg.appendChild(g);
  }

  // közép dísz
  const hub=document.createElementNS(svgNS,'circle');
  hub.setAttribute('cx',cx); hub.setAttribute('cy',cy); hub.setAttribute('r',38);
  hub.setAttribute('class','wheel-hub'); svg.appendChild(hub);
  const dot=document.createElementNS(svgNS,'circle');
  dot.setAttribute('cx',cx); dot.setAttribute('cy',cy); dot.setAttribute('r',6);
  dot.setAttribute('class','wheel-dot'); svg.appendChild(dot);

  return svg;
}

// ===== Init & események =====
function init(){
  loadItems();
  loadOrInitOrderAndProgress();

  // keréken a FIX, egyszeri véletlen sorrend (amíg a kérdések nem változnak)
  const wheelSvg = createWheelSVG(items, order);
  const wheelContainer=document.getElementById('wheel');
  wheelContainer.innerHTML='';
  wheelContainer.appendChild(wheelSvg);

  const wrap=document.querySelector('.wheel-wrap');

  wrap.addEventListener('click', ()=>{
    if(spinning || lockedAfterSpin) return;
    spinning=true;

    // „kamu” sorsolás: mindig a KÖVETKEZŐ eredeti index
    const originalIdx = nextOriginalIndex;             // 0..14, majd 15..17
    const wheelIndex  = order.indexOf(originalIdx);    // hol van a keréken
    const dur = randomDuration();

    spinToWheelIndex(wheelIndex, wrap, dur);

    wrap.addEventListener('transitionend', ()=>{
      spinning=false;
      lockedAfterSpin=true;

      const chosen = items[originalIdx];               // <<< eredeti kérdés szöveg (extráknál is)
      updateResultBox(chosen);
      showModal(chosen);
      setHint('Nyomd meg a Q billentyűt az új pörgetéshez.');

      nextOriginalIndex = (nextOriginalIndex + 1) % SLICE_COUNT;
      localStorage.setItem(KEY_PROGRESS, String(nextOriginalIndex));
    }, {once:true});
  });

  // Q = modál bezár + engedélyezés
  window.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase()==='q'){
      if(spinning) return;
      if(lockedAfterSpin){
        hideModal();
        lockedAfterSpin=false;
        const box=document.getElementById('resultBox');
        const hint=box.querySelector('.muted');
        if(hint) hint.remove();
        box.classList.add('pulse');
        setTimeout(()=>box.classList.remove('pulse'), 400);
      }
    }
  });

  // háttérre kattintás ne zárja a modált (csak Q)
  const bd = document.getElementById('modalBackdrop');
  bd.addEventListener('click', (ev)=>{ if(ev.target===bd){ /* no-op */ } });
}

document.addEventListener('DOMContentLoaded', init);
