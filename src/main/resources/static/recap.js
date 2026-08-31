// Ogni "✕" rimuove un acquisto e ricalcola il budget del partecipante: un click
// sbagliato in colonne strette e ravvicinate cambierebbe in silenzio un numero da
// cui dipendono tutte le raccomandazioni successive. Per questo serve una conferma:
// il primo click trasforma il bottone in "conferma?", solo il secondo click sullo
// STESSO bottone lascia passare il submit. Cliccare altrove o premere Escape annulla
// senza inviare nulla.
document.addEventListener('DOMContentLoaded', () => {
  let confirming = null;

  function reset() {
    if (confirming) {
      confirming.textContent = '✕';
      confirming.classList.remove('confirming');
      confirming = null;
    }
  }

  document.querySelectorAll('.revoke-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (confirming === btn) {
        // Secondo click sullo stesso bottone: lascia proseguire il submit del form.
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
