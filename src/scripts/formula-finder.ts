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
// Task shortcuts show the answer immediately and move keyboard focus to it.
document.querySelectorAll<HTMLButtonElement>('[data-quick-task]').forEach(button => {
  button.addEventListener('click', () => {
    query.value = '';
    task.value = button.dataset.quickTask ?? 'all';
    update();
    cards.find(card => !card.hidden)?.querySelector<HTMLElement>('h2')?.focus();
  });
});
document.querySelector<HTMLButtonElement>('#formula-clear')?.addEventListener('click', () => {
  form.reset();
  update();
  query.focus();
});
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', update);
form.addEventListener('reset', () => { setTimeout(update, 0); });
document.querySelectorAll<HTMLButtonElement>('.formula-copy').forEach(button => button.addEventListener('click', async () => {
  const formula = product.value === 'Excel' ? button.dataset.excel! : button.dataset.sheets!;
  try { await navigator.clipboard.writeText(formula); status.textContent = `${button.closest<HTMLElement>('article')!.dataset.name} example copied for ${product.value}.`; }
  catch {
    const card = button.closest<HTMLElement>('article');
    const shown = card?.querySelector<HTMLElement>(`[data-product="${product.value}"]`);
    const code = shown?.querySelectorAll<HTMLElement>('pre code')[1];
    const selection = window.getSelection();
    if (code && selection) {
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = 'Clipboard access is unavailable. The example formula is selected; use your device copy command.';
    } else {
      status.textContent = 'Clipboard access is unavailable. Select the example formula and copy it manually.';
    }
  }
}));
