package com.fantaagent.adapter.out.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;

/** Conversioni ripetute da ogni repository: date nullable e colonne jsonb. */
final class Columns {

    private Columns() {
    }

    /** pgjdbc non accetta un Instant come parametro: passa da Timestamp. */
    static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    static Instant instant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    static String json(ObjectMapper mapper, Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("valore non serializzabile: " + value.getClass(), e);
        }
    }

    static <T> T fromJson(ObjectMapper mapper, String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("colonna jsonb illeggibile come " + type.getSimpleName(), e);
        }
    }
}
