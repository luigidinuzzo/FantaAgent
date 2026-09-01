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
  // !e.shiftKey esclude Cmd/Ctrl+Shift+Z: su macOS è "ripeti" (redo), non un secondo
  // annulla — senza questo controllo quella combinazione annullerebbe un altro acquisto.
  const shortcutModifier = (e.metaKey || e.ctrlKey) && !e.shiftKey;

  if (shortcutModifier && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'l')) {
    // Non rubare la digitazione: se il fuoco è su un campo di testo non vuoto,
    // lascia che sia il browser a gestire il tasto (es. selezione, cancellazione
    // di parola). La barra comando tiene il fuoco quasi sempre, quindi senza
    // questo controllo la scorciatoia combatterebbe con la digitazione normale.
    // I <select> (es. il partecipante nella riga della tabella di fase) contano
    // sempre come controllo di form, a prescindere dal loro valore: un Cmd+Z con
    // il fuoco su una select non deve annullare l'ultimo acquisto.
    const active = document.activeElement;
    const tag = active && active.tagName;
    if (tag === 'SELECT') {
      return;
    }
    const isTextField = tag === 'INPUT' || tag === 'TEXTAREA';
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

// Svuota la barra comando dopo un acquisto registrato con successo da lì: altrimenti
// resta il testo del comando appena eseguito (es. "bast 47 m"), il fuoco ci torna
// sopra (vedi listener sopra) e Cmd+Z/Cmd+L vedono un campo non vuoto — la guardia
// qui sopra li scambia per digitazione normale e lascia fare al browser, che sul
// campo di testo esegue il suo "annulla" nativo invece di quello dell'app.
// Il listener è sul form stesso, non su document/body: l'evento "fantaStateChanged"
// (header HX-Trigger di risposta) parte dall'elemento che ha fatto la richiesta e
// risale per bubbling, quindi ascoltarlo qui intercetta solo le richieste di QUESTO
// form — non quelle di /undo, /phase/next o delle form "assegna" altrove in pagina,
// che devono lasciare intatto il testo digitato dall'utente. Il controller imposta
// quell'header solo quando l'acquisto è andato a buon fine: un comando rifiutato non
// lo emette, quindi il testo resta per permettere una correzione.
const cmdForm = document.getElementById('cmdForm');
if (cmdForm) {
  cmdForm.addEventListener('fantaStateChanged', () => {
    const cmd = document.getElementById('cmd');
    if (cmd) { cmd.value = ''; }
  });
}
