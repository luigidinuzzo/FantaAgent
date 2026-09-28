-- Schema del portale: utenti, leghe, aste e il loro registro.
-- Le migrazioni non si riscrivono mai dopo essere state applicate: ogni modifica e'
-- un file nuovo con il numero successivo.

CREATE TABLE app_user (
    id                uuid PRIMARY KEY,
    email             text        NOT NULL,
    password_hash     text        NOT NULL,
    display_name      text        NOT NULL,
    email_verified_at timestamptz,
    created_at        timestamptz NOT NULL
);
-- Unica senza distinzione di maiuscole: Mario@x.it e mario@x.it sono la stessa persona.
CREATE UNIQUE INDEX app_user_email_key ON app_user (lower(email));

CREATE TABLE user_token (
    id         uuid PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES app_user (id),
    purpose    text        NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
    -- Solo l'hash: chi legge il database non puo' usare un link che non ha ricevuto.
    token_hash text        NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);

CREATE TABLE league (
    id         uuid PRIMARY KEY,
    name       text        NOT NULL CHECK (length(trim(name)) > 0),
    created_by uuid        NOT NULL REFERENCES app_user (id),
    created_at timestamptz NOT NULL,
    -- I valori predefiniti delle aste future. Un'asta li COPIA quando nasce.
    rules      jsonb       NOT NULL,
    scoring    jsonb       NOT NULL,
    bidder     jsonb       NOT NULL
);

CREATE TABLE league_member (
    league_id uuid        NOT NULL REFERENCES league (id),
    user_id   uuid        NOT NULL REFERENCES app_user (id),
    role      text        NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
    team_name text        NOT NULL CHECK (length(trim(team_name)) > 0),
    initial   char(1)     NOT NULL,
    joined_at timestamptz NOT NULL,
    PRIMARY KEY (league_id, user_id),
    CONSTRAINT league_member_initial_key UNIQUE (league_id, initial)
);

CREATE TABLE league_invite (
    id         uuid PRIMARY KEY,
    league_id  uuid        NOT NULL REFERENCES league (id),
    token_hash text        NOT NULL UNIQUE,
    created_by uuid        NOT NULL REFERENCES app_user (id),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);

CREATE TABLE auction (
    id         uuid PRIMARY KEY,
    league_id  uuid        NOT NULL REFERENCES league (id),
    name       text        NOT NULL CHECK (length(trim(name)) > 0),
    created_by uuid        NOT NULL REFERENCES app_user (id),
    created_at timestamptz NOT NULL,
    -- Cancellare un'asta la nasconde: registro e posti restano.
    deleted_at timestamptz,
    -- Fotografati dalla lega alla creazione, e da li' fissi.
    rules      jsonb       NOT NULL,
    scoring    jsonb       NOT NULL,
    bidder     jsonb       NOT NULL
);
CREATE INDEX auction_league_idx ON auction (league_id);

CREATE TABLE auction_seat (
    auction_id uuid    NOT NULL REFERENCES auction (id),
    user_id    uuid    NOT NULL REFERENCES app_user (id),
    team_name  text    NOT NULL CHECK (length(trim(team_name)) > 0),
    initial    char(1) NOT NULL,
    -- Il turno di chiamata. Differibile: riordinare scambia posizioni dentro una sola
    -- transazione, e il controllo va fatto alla fine, non riga per riga.
    position   int     NOT NULL,
    PRIMARY KEY (auction_id, user_id),
    CONSTRAINT auction_seat_initial_key UNIQUE (auction_id, initial),
    CONSTRAINT auction_seat_position_key UNIQUE (auction_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE auction_event (
    auction_id uuid        NOT NULL REFERENCES auction (id),
    seq        bigint      NOT NULL CHECK (seq >= 1),
    at         timestamptz NOT NULL,
    type       text        NOT NULL,
    payload    jsonb       NOT NULL,
    request_id text,
    actor_id   uuid        NOT NULL REFERENCES app_user (id),
    -- Due scritture concorrenti che calcolano lo stesso seq non passano entrambe.
    CONSTRAINT auction_event_pkey PRIMARY KEY (auction_id, seq),
    -- L'idempotenza degli acquisti: piu' righe con request_id NULL convivono.
    CONSTRAINT auction_event_request_key UNIQUE (auction_id, request_id)
);

-- Il registro e' append-only per costruzione, non per disciplina del codice:
-- correggere o annullare sono eventi nuovi che ne referenziano uno vecchio.
CREATE FUNCTION auction_event_append_only() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION 'auction_event e'' append-only: % non ammesso', TG_OP;
END
$$;

CREATE TRIGGER auction_event_no_update_delete
    BEFORE UPDATE OR DELETE ON auction_event
    FOR EACH ROW EXECUTE FUNCTION auction_event_append_only();

CREATE TRIGGER auction_event_no_truncate
    BEFORE TRUNCATE ON auction_event
    FOR EACH STATEMENT EXECUTE FUNCTION auction_event_append_only();
