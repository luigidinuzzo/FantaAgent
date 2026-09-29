package com.fantaagent.application.service.importing;

import java.util.List;

public record ImportPreview(String name, int purchases, List<FileParticipant> participants) {

    public record FileParticipant(String id, String name, String initial) {
    }
}
