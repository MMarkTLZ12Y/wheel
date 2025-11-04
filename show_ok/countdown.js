const $ = (sel, root=document) => root.querySelector(sel);
const LS_KEY = "tiktok_show_data";

let total = 5 * 60; // 5:00
let remaining = total;
let running = false;
let lastTs = 0;
let rafId = null;

function fmt(sec){
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function render(){
  $("#timer").textContent = fmt(remaining);
}

function tick(ts){
  if(!running){ lastTs = 0; return; }
  if(!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;

  remaining = Math.max(0, remaining - dt);
  render();

  if(remaining <= 0){
    running = false;
    const flash = $("#flash");
    flash.classList.remove("hidden");
    requestAnimationFrame(()=> flash.classList.add("show"));
    setTimeout(()=>{
      flash.classList.remove("show");
      setTimeout(()=>{
        flash.classList.add("hidden");
        window.location.href = "page3.html";  // automatikus továbblépés a műsoroldalra
      }, 350);
    }, 900);
    return;
  }
  rafId = requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', ()=>{
  render();

  // kattintás a számlálóra → indít/szünet
  $("#timer").addEventListener('click', ()=>{
    running = !running;
    if(running){ rafId = requestAnimationFrame(tick); }
  });

  // billentyűk: R = reset, U = műsoroldal, S = kérdések szerkesztése
  window.addEventListener('keydown', (e)=>{
    const k = e.key.toLowerCase();
    if(k === 'r'){
      running = false;
      remaining = total;
      render();
    }else if(k === 'u'){
      window.location.href = "page3.html";
    }else if(k === 's'){
      window.location.href = "index.html";
    }
  });

  // Guard: ha nincs adat az adminból, visszalépés
  const data = localStorage.getItem(LS_KEY);
  if(!data){
    if(confirm("Nincsenek elmentett adatok. Vissza az adminhoz?")){
      window.location.href = "index.html";
    }
  }
});
