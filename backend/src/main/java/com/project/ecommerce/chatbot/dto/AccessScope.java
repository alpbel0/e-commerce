package com.project.ecommerce.chatbot.dto;

import java.util.List;

public record AccessScope(
    List<StoreInfo> ownedStores
) {
}
