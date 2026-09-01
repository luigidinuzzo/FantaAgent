// Ogni "✕" rimuove un acquisto e ricalcola il budget del partecipante: un click
// sbagliato in colonne strette e ravvicinate cambierebbe in silenzio un numero da
// cui dipendono tutte le raccomandazioni successive. Per questo serve una conferma:
// il primo click trasforma il bottone in "conferma?", solo il secondo click sullo
// STESSO bottone lascia passare il submit. Cliccare altrove o premere Escape annulla
// senza inviare nulla.
//
// Il markup marca il bottone type="button": da solo non invia mai il form. Qui, e
// solo qui, il secondo click lo promuove a type="submit" e ne chiede l'invio — se
// questo script non gira, il bottone resta inerte per sempre, mai "un click lo
// invia". Fallire senza JavaScript deve rompere in modo sicuro, non silenzioso.
//
// I listener sono DELEGATI al documento invece che legati a ciascun bottone. Sulla
// pagina di riepilogo la differenza non si vede, perche' una revoca ricarica l'intera
// pagina; sulla pagina BATTITORE il tabellone viene sostituito da htmx ad ogni
// acquisto, e dei listener legati ai singoli bottoni sparirebbero col vecchio markup:
// le ✕ smetterebbero di rispondere dopo il primo acquisto, sullo schermo proiettato,
// senza che nulla lo segnali.
document.addEventListener('DOMContentLoaded', () => {
  let confirming = null;

  function reset() {
    if (confirming) {
      confirming.textContent = '✕';
      confirming.classList.remove('confirming');
      confirming.type = 'button';
      confirming = null;
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('.revoke-btn') : null;

    if (!btn) {
      // Click fuori da qualunque ✕: annulla una conferma in sospeso.
      if (confirming) { reset(); }
      return;
    }

    if (confirming === btn) {
      // Secondo click sullo stesso bottone: promuovilo a submit e invia il form.
      // e.preventDefault() qui non cambia nulla per un type="button" (che non
      // invia mai da solo), ma tiene esplicito che l'invio parte solo da questa
      // riga, mai dal click del browser.
      e.preventDefault();
      btn.type = 'submit';
      btn.form.requestSubmit(btn);
      // Il riferimento non serve piu': il markup sta per essere sostituito, e
      // tenerlo significherebbe puntare a un bottone non piu' nel documento.
      confirming = null;
      return;
    }

    e.preventDefault();
    reset();
    btn.textContent = 'confermi?';
    btn.classList.add('confirming');
    confirming = btn;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      reset();
    }
  });
});
