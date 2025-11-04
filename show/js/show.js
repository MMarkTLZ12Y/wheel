const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const LS_KEY = "tiktok_show_data";
const STATE_KEY = "tiktok_show_state";

let data = null;     // {cohost, questions[], raps[], bgUrl, welcomeText, version}
let state = null;    // {usedQ:number[], usedS:number, version:number|null}

const WHEEL_TOTAL_QUESTIONS = 15;
const WHEEL_TOTAL_SURPRISES = 3;

// ------- Load & Init -------
function load(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch(e){ return null; }
}
function loadState(){
  const raw = localStorage.getItem(STATE_KEY);
  if(!raw) return { usedQ:[], usedS:0, version:null };
  try {
    const s = JSON.parse(raw);
    // védelem
    if(!Array.isArray(s.usedQ)) s.usedQ = [];
    if(typeof s.usedS !== "number") s.usedS = 0;
    return s;
  } catch(e){ return { usedQ:[], usedS:0, version:null }; }
}
function saveState(){
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ------- UI -------
function initUI(){
  // background
  document.documentElement.style.setProperty("--bg-url", `url("${data.bgUrl||'assets/ledwall.gif'}")`);
  $("#welcome").textContent = data.welcomeText || "Üdv a műsorban!";
  $("#cohostPill").textContent = data.cohost || "";
  updateCounters();
}

function updateCounters(){
  $("#usedQ").textContent = state.usedQ.length;
  $("#usedS").textContent = state.usedS;
}

// ------- Wheel -------
let segments = []; // e.g. [{type:"Q", idx:0, label:"Kérdés 1"}, ...]
let spinning = false;
let angle = 0;     // current angle
let speed = 0;

function buildSegments(){
  segments = [];

  // Remaining questions
  for(let i=0;i<WHEEL_TOTAL_QUESTIONS;i++){
    if(!state.usedQ.includes(i)){
      segments.push({ type:"Q", idx:i, label:`Kérdés ${i+1}` });
    }
  }

  // Remaining surprises
  const remainingS = Math.max(0, WHEEL_TOTAL_SURPRISES - state.usedS);
  for(let i=0;i<remainingS;i++){
    segments.push({ type:"S", idx:i, label:"🎁 Meglepetés" });
  }

  if(segments.length===0){
    segments.push({ type:"DONE", label:"Vége – Reseteld a kereket" });
  }
}

function drawWheel(ctx, r){
  const cx = ctx.canvas.width/2;
  const cy = ctx.canvas.height/2;
  const n = segments.length;
  ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const arc = (2*Math.PI)/n;
  for(let i=0;i<n;i++){
    // slice
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0,r, i*arc, (i+1)*arc);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(i*360/n)|0}, 90%, 55%)`;
    ctx.fill();

    // text
    ctx.save();
    ctx.rotate(i*arc + arc/2);
    ctx.textAlign = "right";
    ctx.font = "bold 16px system-ui";
    ctx.fillStyle = "#000";
    ctx.rotate(Math.PI/2);
    ctx.fillText(segments[i].label, r-12, 0);
    ctx.restore();
  }

  // center
  ctx.beginPath();
  ctx.arc(0,0,40,0,2*Math.PI);
  ctx.fillStyle="#fff";
  ctx.fill();

  ctx.restore();

  // pointer
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 6);
  ctx.lineTo(cx-10, cy - r - 26);
  ctx.lineTo(cx+10, cy - r - 26);
  ctx.closePath();
  ctx.fillStyle="#fff";
  ctx.fill();
}

function spinToResult(ctx,r, cb){
  if(spinning) return;
  spinning = true;
  speed = 0.55 + Math.random()*0.35; // initial
  const friction = 0.985;

  function frame(){
    angle += speed;
    speed *= friction;
    drawWheel(ctx, r);
    if(speed < 0.005){
      spinning = false;
      const n = segments.length;
      const arc = (2*Math.PI)/n;
      let a = angle % (2*Math.PI);
      if(a<0) a += 2*Math.PI;
      const idx = (n - Math.floor((a)/(arc)) - 1 + n) % n;
      cb(segments[idx]);
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ------- Interactions -------
function addToHistory(text){
  const li = document.createElement('li');
  li.textContent = text;
  $("#history").appendChild(li);
}

function handleResult(seg){
  const resultEl = $("#result");
  if(seg.type === "Q"){
    const qText = data.questions[seg.idx] || `Kérdés ${seg.idx+1}`;
    resultEl.textContent = qText;
    addToHistory(`Kérdés ${seg.idx+1}: ${qText}`);
    if(!state.usedQ.includes(seg.idx)){
      state.usedQ.push(seg.idx);
      saveState();
      updateCounters();
    }
  } else if(seg.type === "S"){
    openSurprisePicker();
  } else {
    resultEl.textContent = "Minden elem lejátszva. Resetelheted a kereket.";
  }
}

function openWheel(){
  $("#wheelModal").classList.remove("hidden");
  const canvas = $("#wheelCanvas");
  const ctx = canvas.getContext("2d");
  const r = Math.min(canvas.width, canvas.height)/2 - 20;
  buildSegments();
  drawWheel(ctx, r);

  $("#spin").onclick = ()=> spinToResult(ctx, r, handleResult);
  $("#closeWheel").onclick = ()=> $("#wheelModal").classList.add("hidden");
}

function openSurprisePicker(){
  const list = $("#surpriseList");
  list.innerHTML = "";
  const unused = data.raps.map((r,idx)=>({...r, idx})).filter(r=> !r.used && (r.title || r.body));
  if(unused.length===0){
    state.usedS = Math.min(WHEEL_TOTAL_SURPRISES, state.usedS+1);
    saveState();
    updateCounters();
    addToHistory("🎁 Meglepetés: nincs több elérhető elem (átugorva).");
    $("#surpriseModal").classList.add("hidden");
    return;
  }
  unused.forEach(item=>{
    const btn = document.createElement('button');
    btn.className = "btn";
    btn.style.width="100%";
    const whoTag = data.cohost === "Bogi" ? "Rap / Bogi" : "Személyes / Dániel";
    btn.textContent = `${whoTag} – ${item.title || "(Névtelen)"}`
    btn.onclick = ()=>{
      // jelöljük használtként
      data.raps[item.idx].used = true;
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      state.usedS = Math.min(WHEEL_TOTAL_SURPRISES, state.usedS+1);
      saveState();
      updateCounters();
      const label = item.title || "Meglepetés elem";
      addToHistory(`🎁 Meglepetés – ${label}: ${item.body ? item.body : "(nincs szöveg megadva)"}`);
      $("#surpriseModal").classList.add("hidden");
      $("#result").textContent = `${label}\n${item.body || ""}`;
    };
    list.appendChild(btn);
  });
  $("#surpriseModal").classList.remove("hidden");
}

function resetWheel(){
  if(!confirm("Biztosan resetelni szeretnéd? (felhasznált kérdések és meglepetések törlése)")) return;
  state = { usedQ:[], usedS:0, version: data.version || Date.now() };
  saveState();
  updateCounters();
  $("#history").innerHTML = "";
  $$("#result").forEach(el=> el.textContent = "");
}

document.addEventListener('DOMContentLoaded', ()=>{
  data = load();
  if(!data){
    alert("Nincsenek admin adatok. Átirányítás az admin felületre.");
    window.location.href = "index.html";
    return;
  }
  state = loadState();

  // verzió alapú auto-reset: ha új admin mentés történt, nullázzuk a kereket
  if (!state.version || state.version !== data.version) {
    state = { usedQ:[], usedS:0, version: data.version || Date.now() };
    saveState();
  }

  initUI();

  $("#openWheel").addEventListener('click', openWheel);
  $("#resetWheel").addEventListener('click', resetWheel);
  $("#toggleCountdown").addEventListener('click', ()=>{
    window.location.href = "countdown.html";
  });

  $("#cancelSurprise").addEventListener('click', ()=> $("#surpriseModal").classList.add("hidden"));
});
