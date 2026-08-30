// Tastiera: la barra deve essere sempre raggiungibile senza toccare il mouse.
document.addEventListener('keydown', (e) => {
  const cmd = document.getElementById('cmd');

  if (e.key === 'Escape' || (e.key === '/' && document.activeElement !== cmd)) {
    e.preventDefault();
    if (cmd) { cmd.focus(); cmd.select(); }
    return;
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    htmx.trigger('#undoForm', 'submit');
    return;
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    htmx.ajax('GET', '/fragments/targets', { target: '#targets', swap: 'outerHTML' });
  }
});

// Dopo ogni scambio HTMX il focus torna alla barra, pronta per il comando successivo.
document.body.addEventListener('htmx:afterSwap', () => {
  const cmd = document.getElementById('cmd');
  if (cmd) { cmd.focus(); }
});
