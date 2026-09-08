import { expect, test } from '@playwright/test';

/**
 * Precondizione: il backend gira su :8080 con un'asta aperta e almeno un
 * giocatore libero nella fase corrente.
 *
 *   ./run.sh   (in un altro terminale)
 *
 * Questo test esiste perche' il README ammette che la suite Java non esegue
 * JavaScript ne' CSS, e che piu' di un difetto e' uscito esattamente da li'.
 * Spostando l'interfaccia su React, quella zona cieca diventerebbe la
 * maggioranza del prodotto.
 */
test('cercare, valutare, aggiudicare', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('connection-status')).toContainText('In diretta');

  const firstRow = page.locator('tbody tr').first();
  const playerName = await firstRow.locator('button').innerText();
  await firstRow.locator('button').click();

  const card = page.getByTestId('decision-card');
  await expect(card).toContainText(playerName);
  await expect(page.getByTestId('max-bid')).not.toBeEmpty();

  const budgetBefore = await page.getByTestId(/^budget-/).first().innerText();

  await page.getByLabel('Prezzo').fill('1');
  await page.getByRole('button', { name: 'Aggiudica' }).click();

  // Il budget cambia solo DOPO che il server ha confermato: e' la prova che
  // non c'e' aggiornamento ottimistico.
  await expect(page.getByTestId(/^budget-/).first()).not.toHaveText(budgetBefore);

  // E il giocatore aggiudicato sparisce dai liberi.
  await expect(page.locator('tbody tr button', { hasText: playerName })).toHaveCount(0);

  // L'unica live region della pagina dice cosa e' successo, per intero.
  await expect(page.getByRole('status')).toContainText(
    new RegExp(`${playerName} aggiudicato a.+per 1 credito\\. Ti restano `),
  );
});

test('a connessione caduta l azione si disabilita', async ({ page }) => {
  await page.goto('/');
  await page.locator('tbody tr').first().locator('button').click();
  await expect(page.getByRole('button', { name: 'Aggiudica' })).toBeEnabled();

  await page.route('**/api/**', (route) => route.abort());

  await expect(page.getByTestId('connection-status')).toContainText('Connessione persa', {
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Aggiudica' })).toBeDisabled();
  await expect(page.getByTestId('decision-card')).toHaveAttribute('data-stale', 'true');
});
