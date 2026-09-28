import '@testing-library/jest-dom/vitest';

// jsdom non implementa la modale nativa. Il polyfill fa il minimo che i test
// osservano — l'attributo open — senza fingere il focus trap o l'inerzia dello
// sfondo, che restano del browser.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// Il cookie che il backend scrive a ogni risposta: con questo le scritture dei test
// non devono prima chiederlo, e le chiamate a fetch che i test contano restano quelle.
// Dietro il typeof: contrast.test.ts e weights.test.ts leggono i sorgenti da disco
// in un ambiente node, senza document.
if (typeof document !== 'undefined') {
  document.cookie = 'XSRF-TOKEN=token-di-prova; path=/';
}
