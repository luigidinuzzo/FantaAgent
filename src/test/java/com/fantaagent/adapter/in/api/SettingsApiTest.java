package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsHolder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lettura delle impostazioni e validazione al salvataggio, con {@link AuctionRuntime}
 * vero — con il suo archivio su disco — perche' nessuno di questi test arriva a
 * scrivere: si fermano tutti prima, al 200 di lettura o al 422 di un corpo respinto.
 * I casi che invece salvano davvero vivono in {@link SettingsApiCreationTest}, dove
 * serve un {@code AuctionRuntime} finto per controllare le due modalita'
 * preparazione/asta-aperta senza dipendere da cosa l'archivio contiene.
 */
@SpringBootTest
@ActiveProfiles("dev")
class SettingsApiTest {

    private static final String URL = "/api/leagues/default/settings";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionSettingsHolder auctionSettings;

    private MockMvc mvc;

    @Autowired
    private AuctionRuntime runtime;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(auctionSettings.get()).thenReturn(new AuctionSettings(9, false));
    }

    @Test
    void restituisceLeImpostazioniCorrenti() throws Exception {
        mvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bidder.bidTimerSeconds").value(9))
                .andExpect(jsonPath("$.bidder.beepEnabled").value(false))
                .andExpect(jsonPath("$.participants").isArray())
                .andExpect(jsonPath("$.scoring.defendersCounted").isNumber())
                .andExpect(jsonPath("$.auctionOpen").isBoolean());
    }

    /**
     * Le quattro chiavi ci sono sempre, anche quando sono vuote: il client non deve
     * distinguere "nessun errore in questa sezione" da "questa sezione non c'e'".
     */
    @Test
    void unTimerImpossibileTornaSottoLaChiaveDelBattitore() throws Exception {
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("Prova", 500)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/invalid-settings"))
                .andExpect(jsonPath("$.errors.bidder").isArray())
                .andExpect(jsonPath("$.errors.bidder[0]").isString())
                .andExpect(jsonPath("$.errors.participants").isArray())
                .andExpect(jsonPath("$.errors.scoring").isArray())
                .andExpect(jsonPath("$.errors.auction").isArray());
    }

    /**
     * Il nome vive sotto la sua chiave. Se finisse sotto "scoring" si andrebbe a
     * cercarlo accanto ai bonus, che e' il posto sbagliato.
     */
    @Test
    void senzaNomeLErroreStaSottoLaChiaveDellAsta() throws Exception {
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("", 5)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.auction[0]").isString())
                .andExpect(jsonPath("$.errors.bidder").isEmpty());
    }

    @Test
    void unPartecipanteSenzaIdNonFaEsplodereIlDominio() throws Exception {
        String senzaId = SettingsBodies.valid("Prova", 5)
                .replace("\"id\": \"anna\"", "\"id\": \"\"");

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(senzaId))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.participants[0]").isString());
    }

    /**
     * Un corpo senza la chiave "bidder" (un client rotto, un proxy che la perde per
     * strada) e' un errore del chiamante, non del server: deve cadere nel 422 tipizzato
     * che questo endpoint costruisce, non nel ramo generico "internal-error" per una
     * NullPointerException su {@code body.bidder().bidTimerSeconds()}.
     */
    @Test
    void senzaBattitoreNonEsplodeInUnErroreInternoMaTornaUn422() throws Exception {
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content("""
                {
                  "auctionName": "Prova",
                  "participants": [
                    { "id": "anna", "name": "Anna", "initial": "A", "me": true }
                  ],
                  "scoring": {
                    "defenceModifierEnabled": false,
                    "defendersCounted": 3,
                    "thresholds": [ { "minAverage": 0, "bonus": 0 } ],
                    "goalBonus": { "P": 0, "D": 0, "C": 0, "A": 0 },
                    "assist": 1, "penaltyScored": 3, "penaltyMissed": -3,
                    "penaltySaved": 3, "yellowCard": -0.5, "redCard": -1,
                    "goalConceded": -1, "cleanSheet": 1, "confirmed": true
                  }
                }
                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/invalid-settings"))
                .andExpect(jsonPath("$.errors.bidder[0]").isString());
    }

    /**
     * Stessa storia per "scoring", ma solo in preparazione: ad asta aperta quella
     * chiave non si legge nemmeno (vedi la classe {@link SettingsApi}), quindi la
     * NullPointerException di {@code settingsOf} scattava solo qui.
     */
    @Test
    void senzaPunteggioInPreparazioneNonEsplodeInUnErroreInternoMaTornaUn422() throws Exception {
        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content("""
                {
                  "auctionName": "Prova",
                  "bidder": { "bidTimerSeconds": 5, "beepEnabled": true },
                  "participants": [
                    { "id": "anna", "name": "Anna", "initial": "A", "me": true }
                  ]
                }
                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/invalid-settings"))
                .andExpect(jsonPath("$.errors.scoring[0]").isString());
    }
}
