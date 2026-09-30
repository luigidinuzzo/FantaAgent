-- Chi non ha un link d'invito cerca la lega per nome e chiede di entrare; decide
-- l'amministratore. Una richiesta sola per persona e lega: chiedere di nuovo
-- aggiorna il nome della squadra. Accettata o rifiutata, la riga sparisce.
CREATE TABLE league_join_request (
    league_id    uuid        NOT NULL REFERENCES league (id),
    user_id      uuid        NOT NULL REFERENCES app_user (id),
    team_name    text        NOT NULL CHECK (length(trim(team_name)) > 0),
    requested_at timestamptz NOT NULL,
    PRIMARY KEY (league_id, user_id)
);
-- «Le mie richieste»: la chiave comincia dalla lega.
CREATE INDEX league_join_request_user_id_idx ON league_join_request (user_id);
