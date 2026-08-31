// Tastiera: la barra deve essere sempre raggiungibile senza toccare il mouse.
document.addEventListener('keydown', (e) => {
  const cmd = document.getElementById('cmd');

  if (e.key === 'Escape' || (e.key === '/' && document.activeElement !== cmd)) {
    e.preventDefault();
    if (cmd) { cmd.focus(); cmd.select(); }
    return;
  }

  // Su macOS l'annulla è Cmd+Z (metaKey), non Ctrl+Z: senza questo controllo la
  // scorciatoia non scattava mai per chi lavora su Mac. Accettiamo entrambe le
  // combinazioni così l'app si comporta allo stesso modo su Mac e Windows/Linux.
  const shortcutModifier = e.metaKey || e.ctrlKey;

  if (shortcutModifier && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'l')) {
    // Non rubare la digitazione: se il fuoco è su un campo di testo non vuoto,
    // lascia che sia il browser a gestire il tasto (es. selezione, cancellazione
    // di parola). La barra comando tiene il fuoco quasi sempre, quindi senza
    // questo controllo la scorciatoia combatterebbe con la digitazione normale.
    const active = document.activeElement;
    const isTextField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isTextField && active.value !== '') {
      return;
    }
  }

  if (shortcutModifier && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    // Chiamata diretta invece di htmx.trigger('#undoForm', 'submit'): quella
    // dipendeva da un evento submit sintetico che raggiungesse il listener di
    // htmx su un form nascosto, un secondo possibile punto di rottura non
    // riproducibile senza browser. htmx.ajax elimina il dubbio.
    htmx.ajax('POST', '/undo', { target: '#main', swap: 'outerHTML' });
    return;
  }

  if (shortcutModifier && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    const targets = document.getElementById('targets');
    // Toggle: se il pannello ha già contenuto (h3 + tabella caricati da una
    // apertura precedente), Ctrl+L/Cmd+L lo richiude senza un'altra chiamata di
    // rete; altrimenti lo popola. #targets vive fuori da #board (era il difetto
    // S7), quindi il contenuto sopravvive agli swap di stato fra un'apertura e
    // l'altra.
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
