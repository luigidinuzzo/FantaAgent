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
