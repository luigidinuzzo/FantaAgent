/*
  Il battitore d'asta: countdown, rilanci e aggiudicazione.

  Vive interamente qui, nel browser. Il server non sa nulla dei rilanci e non deve
  saperlo: un rilancio non e' un fatto dell'asta, e scriverlo sul registro lo
  riempirebbe di eventi che non si possono annullare in modo sensato. Il solo momento
  in cui si parla col server e' l'aggiudicazione, che passa da /assign come ogni altro
  acquisto.

  Nessun test automatico copre questo file: il progetto non ha un harness che esegua
  JavaScript. Vale la stessa avvertenza scritta in cima ad app.css — la verifica e'
  l'uso, e i punti in cui e' facile sbagliare sono commentati qui sotto uno per uno.
*/
(function () {
  'use strict';

  var MOUNT_ID = 'bidderMount';

  var ticker = null;          // handle del setInterval, null quando il countdown e' fermo
  var deadline = 0;           // istante (ms) in cui il countdown arriva a zero
  var durationMs = 5000;
  var price = 1;
  var maxBid = 0;
  var hardCap = 0;
  var beepEnabled = true;
  var expired = false;
  var assignInFlight = false;
  var audio = null;

  function $(id) { return document.getElementById(id); }
  function dialog() { return $('bidderDialog'); }

  /*
    Un oscillatore invece di un file audio: niente da scaricare, niente da versionare,
    e nessun formato che un browser possa rifiutare. Il contesto si crea al primo uso —
    che avviene sempre dopo un click dell'utente, quindi l'autoplay policy non lo
    blocca. Tutto avvolto in try/catch: se l'audio non e' disponibile il popup deve
    continuare a funzionare, muto.
  */
  function beep() {
    if (!beepEnabled) { return; }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { return; }
      audio = audio || new Ctx();
      if (audio.state === 'suspended') { audio.resume(); }
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.26);
    } catch (e) {
      /* audio non disponibile: resta il segnale visivo */
    }
  }

  function renderPrice() {
    var el = $('bidderPrice');
    if (!el) { return; }
    el.textContent = price;
    var over = $('bidderOver');
    var box = dialog();
    var beyond = maxBid > 0 && price > maxBid;
    if (over) {
      over.hidden = !beyond;
      var by = $('bidderOverBy');
      if (by) { by.textContent = price - maxBid; }
    }
    if (box) { box.classList.toggle('over-max', beyond); }
    var finalPrice = $('bidderFinalPrice');
    if (finalPrice) { finalPrice.value = price; }
  }

  function renderClock(msLeft) {
    var el = $('bidderClock');
    if (!el) { return; }
    /*
      Math.ceil e non round: finche' resta un millisecondo il numero mostrato deve
      essere almeno 1. Con round, l'ultimo mezzo secondo mostrerebbe "0" mentre si puo'
      ancora rilanciare — un timer che dice zero e zero non e' e' peggio di nessun timer.
    */
    el.textContent = Math.max(0, Math.ceil(msLeft / 1000));
  }

  function tick() {
    var left = deadline - Date.now();
    if (left <= 0) {
      renderClock(0);
      expire();
      return;
    }
    renderClock(left);
    var box = $('bidderClockBox');
    if (box) { box.classList.toggle('urgent', left <= 2000); }
  }

  function startCountdown() {
    stopCountdown();
    expired = false;
    deadline = Date.now() + durationMs;
    renderClock(durationMs);
    /*
      Il tempo si misura sull'orologio (deadline - now), non contando i tick: un
      setInterval puo' saltare o ritardare quando la scheda perde il fuoco, e un
      countdown che conta i propri battiti finirebbe in ritardo proprio nel momento in
      cui l'utente sta guardando altrove.
    */
    ticker = window.setInterval(tick, 100);
  }

  function stopCountdown() {
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
  }

  function expire() {
    stopCountdown();
    expired = true;
    beep();
    var controls = $('bidderControls');
    var form = $('bidderAssign');
    var box = $('bidderClockBox');
    if (controls) { controls.hidden = true; }
    if (box) { box.classList.add('expired'); }
    if (form) {
      form.hidden = false;
      var finalPrice = $('bidderFinalPrice');
      if (finalPrice) { finalPrice.value = price; }
      var who = $('bidderWho');
      if (who) { who.focus(); }
    }
  }

  function resumeBidding() {
    var controls = $('bidderControls');
    var form = $('bidderAssign');
    var box = $('bidderClockBox');
    if (form) { form.hidden = true; }
    if (controls) { controls.hidden = false; }
    if (box) { box.classList.remove('expired'); }
    startCountdown();
    var bid = $('bidderBid');
    if (bid) { bid.focus(); }
  }

  function raise(by) {
    if (expired) { return; }
    price = price + by;
    renderPrice();
    startCountdown();
  }

  function jumpTo(value) {
    if (expired) { return; }
    var n = parseInt(value, 10);
    /*
      Solo verso l'alto: in un'asta a rilancio l'offerta non scende mai, e accettare un
      numero piu' basso significherebbe registrare un prezzo che nessuno ha offerto.
    */
    if (!isFinite(n) || n <= price) { return; }
    price = n;
    renderPrice();
    startCountdown();
  }

  function close() {
    stopCountdown();
    var dlg = dialog();
    if (dlg) {
      if (dlg.open) { dlg.close(); }
      dlg.remove();
    }
    var mount = $(MOUNT_ID);
    if (mount) { mount.innerHTML = ''; }
    assignInFlight = false;
    /* Il fuoco torna alla barra comando, da cui si riprende a cercare. */
    var cmd = $('cmd');
    if (cmd) { cmd.focus(); }
  }

  function showError(text) {
    var form = $('bidderAssign');
    if (!form) { return; }
    var box = $('bidderError');
    if (!box) {
      box = document.createElement('p');
      box.id = 'bidderError';
      box.className = 'bidder-error';
      box.setAttribute('role', 'alert');
      form.appendChild(box);
    }
    box.textContent = text;
    box.hidden = false;
  }

  function init() {
    var dlg = dialog();
    if (!dlg) { return; }

    durationMs = (parseInt(dlg.getAttribute('data-seconds'), 10) || 5) * 1000;
    maxBid = parseInt(dlg.getAttribute('data-max-bid'), 10) || 0;
    hardCap = parseInt(dlg.getAttribute('data-hard-cap'), 10) || 0;
    beepEnabled = dlg.getAttribute('data-beep') === 'true';
    price = 1;
    expired = false;
    assignInFlight = false;

    renderPrice();
    dlg.showModal();
    startCountdown();

    var bid = $('bidderBid');
    if (bid) {
      bid.addEventListener('click', function () { raise(1); });
      bid.focus();
    }

    var steps = dlg.querySelectorAll('.bidder-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].addEventListener('click', function (e) {
        raise(parseInt(e.currentTarget.getAttribute('data-step'), 10) || 1);
      });
    }

    var jump = $('bidderJump');
    if (jump) {
      jump.addEventListener('keydown', function (e) {
        /*
          Enter qui non deve inviare nulla: il campo sta dentro al popup ma fuori dal
          form di aggiudicazione, e un invio accidentale a meta' rilancio registrerebbe
          un acquisto che nessuno ha aggiudicato.
        */
        if (e.key === 'Enter') {
          e.preventDefault();
          jumpTo(jump.value);
          jump.value = '';
          var b = $('bidderBid');
          if (b) { b.focus(); }
        }
      });
    }

    var closeBtn = $('bidderClose');
    if (closeBtn) { closeBtn.addEventListener('click', close); }

    var resume = $('bidderResume');
    if (resume) { resume.addEventListener('click', resumeBidding); }

    var form = $('bidderAssign');
    if (form) {
      form.addEventListener('submit', function () { assignInFlight = true; });
    }

    /* Esc: <dialog> chiude da solo, qui resta da fermare il countdown e ripulire. */
    dlg.addEventListener('close', function () {
      stopCountdown();
      var mount = $(MOUNT_ID);
      if (mount) { mount.innerHTML = ''; }
    });
  }

  /*
    La barra spaziatrice e' il rilancio: durante l'asta si guarda la stanza, non lo
    schermo, e cercare un bottone col mouse costa piu' dei cinque secondi disponibili.
    Tre guardie, ognuna per un modo diverso di sbagliare:
      - dentro un campo, lo spazio deve scrivere uno spazio;
      - su un bottone, il browser fa gia' partire il click da solo e intercettare qui
        conterebbe il rilancio due volte;
      - a countdown scaduto non si rilancia piu': c'e' il form di aggiudicazione.
  */
  document.addEventListener('keydown', function (e) {
    var dlg = dialog();
    if (!dlg || !dlg.open) { return; }
    if (e.key !== ' ' && e.code !== 'Space') { return; }
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    var active = document.activeElement;
    if (active) {
      var tag = active.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
        return;
      }
    }
    if (expired) { return; }
    e.preventDefault();
    raise(1);
  });

  document.body.addEventListener('htmx:afterSwap', function (e) {
    var target = e.target || e.detail.target;

    /* Il popup e' appena arrivato dal server: va inizializzato e aperto. */
    if (target && target.id === MOUNT_ID) {
      init();
      return;
    }

    /*
      L'aggiudicazione ha risposto dentro #main. /assign risponde 200 anche quando
      rifiuta l'acquisto (budget insufficiente, slot pieno): affidarsi al codice HTTP
      chiuderebbe il popup su un acquisto mai registrato, perdendo il prezzo raggiunto
      e lasciando l'errore scritto dietro a un popup che nel frattempo e' sparito.
      L'unico segnale affidabile e' il messaggio stesso, che AuctionController scrive
      con ✓ o ✗ in testa.
    */
    if (assignInFlight && target && target.id === 'main') {
      assignInFlight = false;
      var message = target.querySelector('.message');
      var text = message ? message.textContent.trim() : '';
      if (text.charAt(0) === '✗') {
        showError(text);
      } else {
        close();
      }
    }
  });
})();
