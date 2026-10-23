import { filterFormulas } from '../lib/formulas';
const form = document.getElementById('formula-filters') as HTMLFormElement;
const query = document.getElementById('formula-query') as HTMLInputElement;
const product = document.getElementById('formula-product') as HTMLSelectElement;
const task = document.getElementById('formula-task') as HTMLSelectElement;
const status = document.getElementById('formula-status')!;
const cards = Array.from(document.querySelectorAll<HTMLElement>('.formula-card'));
function update() {
  const matches = new Set(filterFormulas(query.value, task.value).map(item => item.name));
  cards.forEach(card => {
    card.hidden = !matches.has(card.dataset.name!);
    card.querySelectorAll<HTMLElement>('[data-product]').forEach(part => { part.hidden = part.dataset.product !== product.value; });
  });
  document.getElementById('formula-empty')!.hidden = matches.size > 0;
  status.textContent = `${matches.size} formula${matches.size === 1 ? '' : 's'}. Showing ${product.value} examples.`;
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('reset', () => { setTimeout(update, 0); });
document.querySelectorAll<HTMLButtonElement>('.formula-copy').forEach(button => button.addEventListener('click', async () => {
  const formula = product.value === 'Excel' ? button.dataset.excel! : button.dataset.sheets!;
  try { await navigator.clipboard.writeText(formula); status.textContent = `${button.closest<HTMLElement>('article')!.dataset.name} example copied for ${product.value}.`; }
  catch { status.textContent = 'Clipboard unavailable. Select the example formula above and copy it manually.'; }
}));
