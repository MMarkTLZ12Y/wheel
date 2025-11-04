// ===== LocalStorage kulcsok (v3) =====
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
let items = [];
let order = [];              // wheelIndex -> originalIndex
let spinning = false;
let lockedAfterSpin = false;
let currentRotation = 0;
let nextOriginalIndex = 0;

// ===== Util =====
function deg2rad(d){return d*Math.PI/180;}
function polarToXY(cx,cy,r,deg){const a=deg2rad(deg);return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
function normalizeDeg(d){let x=d%360; if(x<0)x+=360; return x;}

function loadItems(){
  const raw = JSON.parse(localStorage.getItem(KEY_ITEMS) || '[]');
  items = Array.from({length: SLICE_COUNT}, (_,i)=>{
    const t = (raw[i] || '').trim();
    if (!t) return (i>=NORMAL_COUNT) ? '?' : `(${i+1}. üres)`;
    return t;
  });
}
function getSignature(arr){ return JSON.stringify(arr); }
function isPermutation(a,n){ if(!Array.isArray(a)||a.length!==n) return false;
  const s=new Set(a); if(s.size!==n) return false; for(let i=0;i<n;i++) if(!s.has(i)) return false; return true; }
function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

// === Keréksorrend generálása, extrák 1/3 körönként ===
function buildWheelOrderWithSpacedExtras(){
  const allNormals = Array.from({length:NORMAL_COUNT}, (_,i)=>i); // 0..14
  const shuffledNormals = shuffle(allNormals);
  const offset = Math.floor(Math.random()*6);
  const extraPositions = [offset, (offset+6)%SLICE_COUNT, (offset+12)%SLICE_COUNT];

  const result = new Array(SLICE_COUNT).fill(null);
  const extras = [15,16,17];
  for (let k=0;k<3;k++) result[extraPositions[k]] = extras[k];

  let ni = 0;
  for (let i=0;i<SLICE_COUNT;i++){
    if (result[i] === null){
      result[i] = shuffledNormals[ni++];
    }
  }
  return result;
}

// ----- Véletlen keréksorrend + „kamu” haladás -----
function loadOrInitOrderAndProgress(){
  const sig = getSignature(items);
  const oldSig = localStorage.getItem(KEY_SIG);

  if (oldSig !== sig) {
    order = buildWheelOrderWithSpacedExtras();
    localStorage.setItem(KEY_ORDER, JSON.stringify(order));
    localStorage.setItem(KEY_SIG, sig);
    nextOriginalIndex = 0;
    localStorage.setItem(KEY_PROGRESS, String(nextOriginalIndex));
    return;
  }

  try{
    const saved = JSON.parse(localStorage.getItem(KEY_ORDER) || '[]');
    const extrasOk = Array.isArray(saved) && saved.length===SLICE_COUNT && (() => {
      const idxs = [];
      for(let i=0;i<SLICE_COUNT;i++) if(saved[i] >= NORMAL_COUNT) idxs.push(i);
      if (idxs.length!==3) return false;
      const a=idxs.sort((x,y)=>x-y);
      const d1=(a[1]-a[0]+SLICE_COUNT)%SLICE_COUNT;
      const d2=(a[2]-a[1]+SLICE_COUNT)%SLICE_COUNT;
      const d3=(a[0]-a[2]+SLICE_COUNT)%SLICE_COUNT;
      return d1===6 && d2===6 && d3===6;
    })();

    if (isPermutation(saved, SLICE_COUNT) && extrasOk) {
      order = saved;
    } else {
      order = buildWheelOrderWithSpacedExtras();
    }
    localStorage.setItem(KEY_ORDER, JSON.stringify(order));
  }catch{
    order = buildWheelOrderWithSpacedExtras();
    localStorage.setItem(KEY_ORDER, JSON.stringify(order));
  }

  const p = parseInt(localStorage.getItem(KEY_PROGRESS) || '0', 10);
  nextOriginalIndex = isFinite(p) ? ((p%SLICE_COUNT)+SLICE_COUNT)%SLICE_COUNT : 0;
}

// ----- MODÁL -----
function showModal(text){
  const bd = document.getElementById('modalBackdrop');
  const t  = document.getElementById('modalText');
  t.textContent = text;

  bd.classList.add('show');
  bd.setAttribute('aria-hidden','false');

  requestAnimationFrame(fitModalText);
}
function hideModal(){
  const bd = document.getElementById('modalBackdrop');
  bd.classList.remove('show');
  bd.setAttribute('aria-hidden','true');
}

function fitModalText(){
  const modal = document.querySelector('.modal');
  const t = document.getElementById('modalText');
  if (!modal || !t) return;

  const cs = getComputedStyle(modal);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const maxW = modal.clientWidth - padX;

  const minPx = Math.max(24, Math.floor(window.innerWidth * 0.02));
  const maxPx = Math.min(200, Math.floor(window.innerWidth * 0.12));
  let lo=minPx, hi=maxPx, best=minPx;

  t.style.whiteSpace = 'normal';
  t.style.wordBreak  = 'break-word';
  t.style.maxHeight  = '';

  while (lo <= hi) {
    const mid = Math.floor((lo+hi)/2);
    t.style.fontSize = mid + 'px';

    const lh = parseFloat(getComputedStyle(t).lineHeight);
    const lines = Math.round(t.scrollHeight / lh);
    const wideEnough = t.scrollWidth <= maxW;

    if (lines <= 2 && wideEnough) { best = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }

  t.style.fontSize = best + 'px';
  const lh = parseFloat(getComputedStyle(t).lineHeight);
  t.style.maxHeight = (2 * lh) + 'px';
}

window.addEventListener('resize', () => {
  const bd = document.getElementById('modalBackdrop');
  if (bd && bd.classList.contains('show')) fitModalText();
});

// ----- Pörgés -----
function computeExtraRotationToAlign(centerAngle,currentRot){
  const targetAt=270;
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

// ----- Címke vágás (kerék szeletein) -----
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
const _measureCanvas=document.createElement('canvas');
const _ctx=_measureCanvas.getContext('2d');
function textWidthPx(text, sizePx, fam='600 12px system-ui, Arial, sans-serif'){
  const f=fam.replace(/\d+px/, sizePx+'px'); _ctx.font=f; return _ctx.measureText(text).width;
}
function bestFontSizeThatFits(text, maxW, minPx=10, maxPx=16, fam='600 12px system-ui, Arial, sans-serif'){
  let lo=minPx, hi=maxPx, ans=minPx;
  while(lo<=hi){ const mid=Math.floor((lo+hi)/2); const w=textWidthPx(text, mid, fam);
    if(w<=maxW){ ans=mid; lo=mid+1; } else { hi=mid-1; } }
  return ans;
}

// ===== Kerék (SVG) – extra szeletek az eredeti index alapján =====
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

  const bg=document.createElementNS(svgNS,'circle');
  bg.setAttribute('cx',cx); bg.setAttribute('cy',cy); bg.setAttribute('r',r+6);
  bg.setAttribute('class','wheel-bg');
  svg.appendChild(bg);

  for(let i=0;i<orderArr.length;i++){
    const originalIndex = orderArr[i];
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
    if(isExtra){ path.setAttribute('fill','#FFD93D'); }
    else { path.setAttribute('fill', i%2 ? '#5cb6ff' : '#7cc7ff'); }
    path.setAttribute('stroke','#ffffff');
    svg.appendChild(path);

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
      div.textContent='?';
    }else{
      const full = itemsArr[originalIndex];
      const clipped = formatLabel24(full);
      const best = bestFontSizeThatFits(clipped, labelW-8, 10, 16);
      div.style.fontSize = best + 'px';
      div.style.textAlign='left';
      div.textContent = clipped;
      div.setAttribute('title', full);
    }

    fo.appendChild(div);
    g.appendChild(fo);
    svg.appendChild(g);
  }

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

  const wheelSvg = createWheelSVG(items, order);
  const wheelContainer=document.getElementById('wheel');
  wheelContainer.innerHTML='';
  wheelContainer.appendChild(wheelSvg);

  const wrap=document.querySelector('.wheel-wrap');

  wrap.addEventListener('click', ()=>{
    if(spinning || lockedAfterSpin) return;
    spinning=true;

    const originalIdx = nextOriginalIndex;
    const wheelIndex  = order.indexOf(originalIdx);
    const dur = randomDuration();

    spinToWheelIndex(wheelIndex, wrap, dur);

    wrap.addEventListener('transitionend', ()=>{
      spinning=false;
      lockedAfterSpin=true;

      const chosen = items[originalIdx];
      showModal(chosen);

      nextOriginalIndex = (nextOriginalIndex + 1) % SLICE_COUNT;
      localStorage.setItem(KEY_PROGRESS, String(nextOriginalIndex));
    }, {once:true});
  });

  // Billentyűk: Q = popup zár; S = index; C = visszaszámláló
  window.addEventListener('keydown', (e)=>{
    const k = e.key.toLowerCase();
    if (k === 'q'){
      if(spinning) return;
      if(lockedAfterSpin){
        hideModal();
        lockedAfterSpin=false;
      }
    } else if (k === 's'){
      // kérdések szerkesztése
      window.location.href = 'index.html';
    } else if (k === 'c'){
      // visszaszámláló (page2.html)
      window.location.href = 'page2.html';
    }
  });

  const bd = document.getElementById('modalBackdrop');
  bd.addEventListener('click', (ev)=>{ if(ev.target===bd){ /* no-op, csak Q-val zárjuk */ } });
}

document.addEventListener('DOMContentLoaded', init);
