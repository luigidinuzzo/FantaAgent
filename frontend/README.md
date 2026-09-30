# frontend

L'interfaccia React che sostituirà, una schermata alla volta, le pagine Thymeleaf di
FantaAgent. Parla solo con l'API JSON del backend: non c'è stato di dominio qui
dentro, e nessun mock — il server resta l'unica verità anche in sviluppo.

## Sviluppo

```bash
npm install
npm run dev
```

Serve su <http://localhost:5173> e inoltra `/api` a `localhost:8080`, quindi **il
backend deve essere in esecuzione**, con un'asta aperta: senza, ogni richiesta
risponde 409 «Nessuna asta è aperta».

L'`auctionId` inviato di default è il letterale riservato `corrente`, che significa
«qualunque asta sia aperta». Alla prima richiesta il client non conosce ancora
nessun identificativo: lo apprende dalla risposta di `/state`.

## Test

```bash
npm test      # Vitest + Testing Library, ambiente jsdom
npm run build # tsc -b (strict) + vite build
npm run lint  # oxlint
```

Gli spec Playwright in `e2e/` sono un'altra cosa: girano contro un backend vero e
**scrivono acquisti veri nel registro dell'asta**, che essendo append-only si possono
solo compensare, non cancellare. Non fanno parte di `npm test` e non vanno lanciati
per abitudine. Playwright non avvia il backend da sé: è una precondizione dichiarata.

## Guardare le schermate

Le prove in jsdom non dicono niente su proporzioni, vuoti e colori. `npm run screens`
fotografa ogni pagina a 1440×900 e a 390×844 rispondendo al posto del backend, quindi
non serve `./run.sh` e non si creano aste vere:

```bash
npm run dev                                   # in un altro terminale
npm run screens -- test-results/screens/dopo  # un PNG per pagina
```

In fondo stampa le pagine che scorrono di lato e le chiamate a cui non ha saputo
rispondere. Se Vite non è sulla 5173: `BASE=http://localhost:5175 npm run screens`.

## Colori

I token non si scrivono a mano. `scripts/palette.mjs` tiene la palette in esadecimale
e ne deriva `src/styles/tokens.css` in OKLCH:

```bash
npm run tokens
```

`src/styles/contrast.test.ts` fa due cose: verifica ogni coppia di colori che la
grafica mette davvero una sopra l'altra contro la soglia WCAG della dimensione con
cui è resa, e verifica che `tokens.css` sia rigenerato dalla palette corrente —
modificare l'uno senza l'altro fa fallire la suite.
