import { useEffect, useState, type RefObject } from 'react';

/** Vero se l'elemento scorre davvero per conto suo, non solo se potrebbe. */
function scrollsItself(el: HTMLElement): boolean {
  const overflow = getComputedStyle(el).overflowY;
  return (overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight;
}

/**
 * Quale sezione di una pagina lunga si sta leggendo, per evidenziarla nell'indice.
 *
 * <p>E' l'ultima sezione il cui inizio e' gia' salito sopra una linea poco sotto il
 * bordo di cio' che scorre: quella di cui si sta leggendo il contenuto, anche se il
 * suo titolo e' ormai uscito di vista. In fondo vince l'ultima: una sezione corta
 * alla fine non arriverebbe mai fino a quella linea, e l'indice resterebbe fermo
 * sulla penultima proprio mentre la si guarda.
 *
 * <p>Cio' che scorre puo' essere il riquadro passato in {@code rootRef} (le
 * impostazioni da tablet in su: il riquadro sta fermo e scorre dentro) oppure la
 * pagina intera (sul telefono, o senza riquadro). Si decide a ogni misura, perche'
 * cambia col ridimensionare la finestra.
 *
 * <p>Si ricalcola scorrendo e ridimensionando, non a ogni render.
 *
 * @param ids gli id delle sezioni, nell'ordine in cui stanno nella pagina
 * @param ready vero quando le sezioni sono in pagina: prima (mentre carica) non c'e'
 *              niente da misurare, e senza ripartire l'indice resterebbe spento
 *              fino al primo scorrimento
 * @param rootRef il riquadro che scorre, se ce n'e' uno
 * @param offset quanto sotto il bordo di cio' che scorre sta la linea, in pixel,
 *               quando a scorrere e' la pagina (sotto la barra fissa in alto)
 */
export function useActiveSection(
  ids: readonly string[],
  ready: boolean,
  rootRef?: RefObject<HTMLElement | null>,
  offset = 140,
): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    if (!ready) return;
    const list = key.split('|');
    const root = rootRef?.current ?? null;
    let frame = 0;
    function measure() {
      frame = 0;
      const box = root && scrollsItself(root) ? root : null;
      // La linea: poco sotto il bordo alto del riquadro, o sotto la barra fissa.
      const line = box ? box.getBoundingClientRect().top + 48 : offset;
      const atBottom = box
        ? box.scrollTop + box.clientHeight >= box.scrollHeight - 2 && box.scrollTop > 0
        : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
          && window.scrollY > 0;
      let current: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (current === null || top <= line) current = id;
        if (top > line) break;
      }
      const last = [...list].reverse().find((id) => document.getElementById(id));
      setActive(atBottom && last ? last : current);
    }
    // Un solo calcolo per fotogramma: scroll arriva molte volte al secondo.
    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(measure);
    }
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    root?.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      root?.removeEventListener('scroll', schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [key, ready, rootRef, offset]);

  return active;
}
