import { type Browser, type Page, expect, test } from '@playwright/test';

/**
 * Precondizione: il backend gira su :8080, su un database di prova.
 *
 *   FANTAAGENT_DB_DIR=$(mktemp -d) ./run.sh      (in un altro terminale)
 *
 * La prova crea utenti, una lega e un'asta veri: su una cartella temporanea non
 * tocca data/pg. Ogni esecuzione usa indirizzi nuovi, quindi si puo' ripetere sullo
 * stesso database.
 *
 * Esiste perche' la suite Java non esegue JavaScript ne' CSS, e i test del frontend
 * girano su risposte finte: qui c'e' il percorso intero, due persone in due browser
 * separati — due contesti, due sessioni — sullo stesso backend.
 */

const PASSWORD = 'una-password-lunga-e2e';

async function register(browser: Browser, name: string, email: string, from = '/registrati'): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(from);
  if (from !== '/registrati') {
    await page.getByRole('link', { name: 'Registrati' }).click();
  }
  await page.getByLabel('Il tuo nome').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: "Crea l'account" }).click();
  return page;
}

test('lega, invito, asta: l aggiudicazione dell amministratore arriva al membro', async ({ browser }) => {
  const stamp = Date.now();

  // L'amministratore si registra e crea la lega.
  const admin = await register(browser, 'Anna', `anna-${stamp}@example.com`);
  await expect(admin.getByRole('heading', { name: 'Le mie leghe' })).toBeVisible();
  await admin.getByLabel('Nome della lega').fill(`Lega ${stamp}`);
  await admin.getByLabel('La tua squadra').fill('Anna FC');
  await admin.getByLabel('La tua iniziale').fill('A');
  await admin.getByRole('button', { name: 'Crea la lega' }).click();
  await expect(admin.getByRole('heading', { name: `Lega ${stamp}`, level: 1 })).toBeVisible();

  // Il link d'invito e' composto sull'indirizzo pubblico: qui conta solo il percorso.
  await admin.getByRole('button', { name: "Crea un link d'invito" }).click();
  const link = await admin.getByLabel("Link d'invito").inputValue();
  const invitePath = new URL(link).pathname;

  // Il membro apre l'invito in un altro browser, si registra da li' e ci torna.
  const member = await register(browser, 'Bruno', `bruno-${stamp}@example.com`, invitePath);
  await member.getByLabel('La tua squadra').fill('Bruno United');
  await member.getByLabel('La tua iniziale').fill('B');
  await member.getByRole('button', { name: 'Entra nella lega' }).click();
  await expect(member.getByRole('heading', { name: `Lega ${stamp}`, level: 1 })).toBeVisible();

  // L'amministratore vede il nuovo membro e crea l'asta.
  await admin.reload();
  await expect(admin.getByRole('list', { name: 'Membri' })).toContainText('Bruno United');
  await admin.getByLabel('Nome della nuova asta').fill('Asta di prova');
  await admin.getByRole('button', { name: "Crea l'asta" }).click();
  await expect(admin).toHaveURL(/\/leghe\/[^/]+\/aste\/[^/]+$/);
  const auctionPath = new URL(admin.url()).pathname;

  // Il membro apre la stessa asta: la segue, ma non ha comandi.
  await member.goto(auctionPath);
  const memberCredits = member.getByRole('region', { name: 'Crediti delle squadre' });
  await expect(memberCredits.getByRole('listitem').filter({ hasText: 'Bruno United' }))
    .toContainText('500 crediti');
  await expect(member.getByRole('button', { name: 'Annulla ultimo acquisto' })).toHaveCount(0);

  // L'amministratore mette sul banco il primo portiere e lo aggiudica al membro.
  const firstFree = admin.getByRole('button', { name: /^Valuta / }).first();
  const playerName = (await firstFree.innerText()).trim();
  await firstFree.click();
  await admin.getByRole('button', { name: 'Aggiudica direttamente' }).click();
  await admin.getByRole('spinbutton', { name: 'Prezzo' }).fill('7');
  await admin.getByRole('combobox', { name: 'Aggiudica a' }).selectOption({ label: 'Bruno United' });
  await admin.getByRole('button', { name: 'Aggiudica', exact: true }).click();

  // I crediti cambiano solo dopo la conferma del registro: niente aggiornamenti ottimistici.
  await expect(admin.getByRole('region', { name: 'Crediti delle squadre' })
    .getByRole('listitem').filter({ hasText: 'Bruno United' })).toContainText('493 crediti');

  // Il membro lo vede comparire da solo, entro l'intervallo di aggiornamento.
  await expect(memberCredits.getByRole('listitem').filter({ hasText: 'Bruno United' }))
    .toContainText('493 crediti', { timeout: 15_000 });
  await member.getByRole('tab', { name: 'Rose squadre' }).click();
  await expect(member.getByRole('tabpanel', { name: 'Rose squadre' })).toContainText(playerName);
});
