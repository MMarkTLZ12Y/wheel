// Helpers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const LS_KEY = "tiktok_show_data";

function buildQuestions(container){
  container.innerHTML = "";
  for(let i=1;i<=15;i++){
    const row = document.createElement('div');
    row.className = 'q-row';
    row.innerHTML = `
      <div class="pill">${i}.</div>
      <input type="text" placeholder="Kérdés ${i}" data-idx="${i-1}" />
    `;
    container.appendChild(row);
  }
}

function buildRaps(container){
  container.innerHTML = "";
  for(let i=1;i<=7;i++){
    const wrap = document.createElement('div');
    wrap.className = 'rap-row';
    wrap.innerHTML = `
      <div class="rap-row-title">
        <div class="pill">#${i}</div>
        <input type="text" placeholder="Cím / rövid megnevezés" data-type="title" data-idx="${i-1}"/>
      </div>
      <textarea placeholder="Szöveg / személyes kérdés leírása" data-type="body" data-idx="${i-1}"></textarea>
    `;
    container.appendChild(wrap);
  }
}

function loadData(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch(e){ return null; }
}

function saveData(data){
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function setStatus(msg){
  $("#status").textContent = msg;
  setTimeout(()=> $("#status").textContent = "", 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  const questionsEl = $("#questions");
  const rapsEl = $("#raps");
  buildQuestions(questionsEl);
  buildRaps(rapsEl);

  // Load previous
  const prev = loadData();
  if(prev){
    // cohost
    if(prev.cohost){
      const radio = $(`input[name="cohost"][value="${prev.cohost}"]`);
      if(radio) radio.checked = true;
    }
    // questions
    if(Array.isArray(prev.questions)){
      prev.questions.slice(0,15).forEach((q, idx)=>{
        const inp = $(`input[data-idx="${idx}"]`, questionsEl);
        if(inp) inp.value = q || "";
      });
    }
    // raps
    if(Array.isArray(prev.raps)){
      prev.raps.slice(0,7).forEach((r, idx)=>{
        const t = $(`input[data-type="title"][data-idx="${idx}"]`, rapsEl);
        const b = $(`textarea[data-type="body"][data-idx="${idx}"]`, rapsEl);
        if(t) t.value = r.title || "";
        if(b) b.value = r.body || "";
      });
    }
    // settings
    if(prev.bgUrl) $("#bgUrl").value = prev.bgUrl;
    if(prev.welcomeText) $("#welcomeText").value = prev.welcomeText;
  }

  $("#fill-demo").addEventListener('click', ()=>{
    $$("#questions input").forEach((inp,i)=> inp.value = `Demo kérdés ${i+1}`);
    $$("#raps input[data-type='title']").forEach((inp,i)=> inp.value = `Rap/Személyes #${i+1}`);
    $$("#raps textarea[data-type='body']").forEach((ta,i)=> ta.value = `Tartalom #${i+1} – szöveg vagy személyes kérdés.`);
    setStatus("Demo adatok kitöltve.");
  });

  $("#save").addEventListener('click', ()=>{
    const cohost = ($("input[name='cohost']:checked")||{}).value || "";
    const questions = $$("#questions input").map(i=> i.value.trim()).slice(0,15);
    const raps = Array.from({length:7}).map((_,i)=>({
      title: $(`input[data-type='title'][data-idx='${i}']`).value.trim(),
      body:  $(`textarea[data-type='body'][data-idx='${i}']`).value.trim(),
      used: false
    }));
    const bgUrl = $("#bgUrl").value.trim() || "assets/ledwall.gif";
    const welcomeText = $("#welcomeText").value.trim() || "Üdv a műsorban!";

    if(!cohost){ alert("Válaszd ki a társműsorvezetőt (Bogi vagy Dániel)!"); return; }
    if(questions.filter(Boolean).length < 15){
      if(!confirm("Nem minden kérdés van kitöltve. Folytatod így?")) return;
    }

    // új verzió bélyeg
    const version = Date.now();

    // mentés
    saveData({ cohost, questions, raps, bgUrl, welcomeText, version });

    // a kerék állapotának törlése, hogy biztosan megjelenjen mind a 15 kérdés
    localStorage.removeItem("tiktok_show_state");

    setStatus("Mentve ✅ (kerék állapot nullázva)");
  });

  $("#start").addEventListener('click', ()=>{
    $("#save").click();
    window.location.href = "countdown.html";
  });
});
