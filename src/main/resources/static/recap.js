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

  document.querySelectorAll('.revoke-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (confirming === btn) {
        // Secondo click sullo stesso bottone: promuovilo a submit e invia il form.
        // e.preventDefault() qui non cambia nulla per un type="button" (che non
        // invia mai da solo), ma tiene esplicito che l'invio parte solo da questa
        // riga, mai dal click del browser.
        e.preventDefault();
        btn.type = 'submit';
        btn.form.requestSubmit(btn);
        return;
      }
      e.preventDefault();
      reset();
      btn.textContent = 'confermi?';
      btn.classList.add('confirming');
      confirming = btn;
    });
  });

  document.addEventListener('click', (e) => {
    if (confirming && !confirming.contains(e.target)) {
      reset();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      reset();
    }
  });
});
