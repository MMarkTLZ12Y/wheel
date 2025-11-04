// 18 mező: 15 normál + 3 extra
const KEY = 'kerdesek';
const TOTAL = 18;
const NORMAL_COUNT = 15;

(function buildInputs() {
  const wrap = document.getElementById('inputs');

  for (let i = 1; i <= TOTAL; i++) {
    const label = document.createElement('label');
    label.setAttribute('for', 'q' + i);
    label.textContent = i <= NORMAL_COUNT ? `${i}. kérdés` : `Extra ${i - NORMAL_COUNT}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'q' + i;
    input.placeholder = label.textContent;

    wrap.appendChild(label);
    wrap.appendChild(input);
  }
})();

// visszatöltés, ha van
(function restore() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    arr.forEach((val, idx) => {
      const el = document.getElementById('q' + (idx + 1));
      if (el) el.value = val || '';
    });
  } catch {}
})();

// mentés + tovább
document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const out = [];
  for (let i = 1; i <= TOTAL; i++) {
    const v = (document.getElementById('q' + i).value || '').trim();
    out.push(v);
  }
  localStorage.setItem(KEY, JSON.stringify(out));
  window.location.href = 'page2.html';
});

// ürítés
document.getElementById('torol').addEventListener('click', () => {
  for (let i = 1; i <= TOTAL; i++) {
    const el = document.getElementById('q' + i);
    if (el) el.value = '';
  }
});
