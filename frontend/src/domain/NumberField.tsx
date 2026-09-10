import { useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

/**
 * Un {@code <input type="number">} controllato che non perde un {@code -} o un
 * {@code .} appena digitati.
 *
 * <p>Un controllato che facesse {@code onChange({...value: Number(e.target.value)})}
 * si romperebbe cosi': l'algoritmo di sanitizzazione del valore dell'HTML fa leggere
 * {@code input.value} come stringa vuota per un numero PARZIALE-ma-non-ancora-valido
 * (Number("") === 0 perche' la stringa vuota tratta come input azzerato, con lo stesso
 * risultato di Number("-") === NaN o Number("0.") che invece VALE 0). Digitare "-" da
 * solo farebbe quindi ridisegnare React con 0, spazzando via il meno prima che il resto
 * della cifra potesse seguirlo — e lo stesso per il punto di "0.". Otto dei diciassette
 * campi di {@link ScoringFieldset} portano normalmente valori negativi o frazionari, ed
 * e' l'unica schermata la cui RAGIONE D'ESSERE e' editarli.
 *
 * <p>La soluzione e' un buffer di testo locale, sincronizzato dal `value` esterno solo
 * quando i due divergono DAVVERO — non a ogni render. Sincronizzare a ogni render
 * romperebbe esattamente il caso che si vuole risolvere: dopo aver digitato "-0",
 * {@code onChange(-0)} farebbe tornare {@code value} a -0, che React confronta uguale
 * a 0 (-0 === 0) e quindi non fa ripartire l'effetto — il buffer resta "-0" e il meno
 * sopravvive al giro. Se invece si sincronizzasse SEMPRE, {@code String(-0)} e' "0", e
 * il meno appena digitato sparirebbe nello stesso istante in cui e' stato scritto.
 */
export function NumberField({
  value,
  onChange,
  ...rest
}: {
  value: number;
  onChange: (value: number) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [raw, setRaw] = useState(() => String(value));

  useEffect(() => {
    // Solo se il buffer non descrive gia' questo stesso valore: altrimenti un
    // giro di andata e ritorno attraverso onChange (commit -> il chiamante
    // rimanda giu' lo stesso `value` come prop) risincronizzerebbe il buffer
    // alla forma "canonica" del numero, perdendo un "-0" o uno "0." ancora a
    // meta' digitazione.
    if (Number(raw) !== value) {
      setRaw(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      value={raw}
      onChange={(e) => {
        const next = e.target.value;
        setRaw(next);
        const parsed = Number(next);
        // "" (campo vuoto) e "-" / "0." (numero ancora a meta') non si commettono:
        // solo un numero finito e completo raggiunge il chiamante. Il buffer locale
        // resta comunque quello digitato, cosi' il carattere non scompare dallo
        // schermo mentre si continua a scrivere.
        if (next !== '' && Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
      {...rest}
    />
  );
}
