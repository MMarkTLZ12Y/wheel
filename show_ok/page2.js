const KEY = 'kerdesek';
const TOTAL = 18;

document.addEventListener('DOMContentLoaded', () => {
  const c = document.getElementById('lista');
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { lista = []; }

  if (!Array.isArray(lista) || lista.length === 0) {
    const p = document.createElement('p');
    p.className = 'ures';
    p.textContent = 'Még nincs elmentett kérdés. Térj vissza az index.html-re és add meg őket.';
    c.appendChild(p);
    return;
  }

  for (let i = 0; i < TOTAL; i++) {
    const p = document.createElement('p');
    const text = (lista[i] || '').trim();
    p.textContent = `${i + 1}. ${text || '(üres)'}`;
    c.appendChild(p);
  }
});
