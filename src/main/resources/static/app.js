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
    const targets = document.getElementById('targets');
    // Toggle: se il pannello ha già contenuto (h3 + tabella caricati da una
    // apertura precedente), Ctrl+L lo richiude senza un'altra chiamata di rete;
    // altrimenti lo popola. #targets vive fuori da #board (era il difetto S7),
    // quindi il contenuto sopravvive agli swap di stato fra un'apertura e l'altra.
    if (targets && targets.childElementCount > 0) {
      targets.innerHTML = '';
    } else {
      htmx.ajax('GET', '/fragments/targets', { target: '#targets', swap: 'outerHTML' });
    }
  }
});

// #cmd non è più dentro la regione che gli swap sostituiscono (era il difetto A),
// quindi digitare non lo perde più di focus da solo. Questo listener resta perché
// serve ancora un caso reale: cliccare "fase successiva →" sposta il focus sul
// bottone, e quel bottone vive dentro #status che viene rimpiazzato out-of-band a
// ogni comando — senza questo listener il focus resterebbe perso sul <body>.
document.body.addEventListener('htmx:afterSwap', () => {
  const cmd = document.getElementById('cmd');
  if (cmd) { cmd.focus(); }
});
