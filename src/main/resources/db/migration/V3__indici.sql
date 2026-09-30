-- Le ricerche per utente. La chiave di league_member comincia dalla lega, e
-- user_token non ha un indice per utente: «le mie leghe»
-- e i link di un utente scorrevano l'intera tabella.
-- In una migrazione nuova e non in V1: V1 e V2 possono essere gia' applicate.
CREATE INDEX league_member_user_id_idx ON league_member (user_id);
CREATE INDEX user_token_user_id_idx ON user_token (user_id);
