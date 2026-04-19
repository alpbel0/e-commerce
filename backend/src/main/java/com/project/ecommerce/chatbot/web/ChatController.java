package com.project.ecommerce.chatbot.web;

import com.project.ecommerce.auth.dto.AccessScopeResponse;
import com.project.ecommerce.auth.service.AccessScopeService;
import com.project.ecommerce.chatbot.dto.AccessScope;
import com.project.ecommerce.chatbot.dto.ChatAskRequest;
import com.project.ecommerce.chatbot.dto.ChatAskResponse;
import com.project.ecommerce.chatbot.dto.ChatSessionStateResponse;
import com.project.ecommerce.chatbot.dto.ConversationMessage;
import com.project.ecommerce.chatbot.dto.StoreInfo;
import com.project.ecommerce.chatbot.dto.UserContext;
import com.project.ecommerce.chatbot.service.ChatConversationService;
import com.project.ecommerce.chatbot.service.ChatService;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final AccessScopeService accessScopeService;
    private final ChatConversationService chatConversationService;

    public ChatController(
        ChatService chatService,
        AccessScopeService accessScopeService,
        ChatConversationService chatConversationService
    ) {
        this.chatService = chatService;
        this.accessScopeService = accessScopeService;
        this.chatConversationService = chatConversationService;
    }

    @GetMapping("/session/active")
    public ResponseEntity<ChatSessionStateResponse> getActiveSession(
        @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return ResponseEntity.ok(chatConversationService.getActiveSession(user.getUserId()));
    }

    @PostMapping("/session/new")
    public ResponseEntity<ChatSessionStateResponse> createNewSession(
        @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return ResponseEntity.ok(chatConversationService.createNewSession(user.getUserId()));
    }

    @PostMapping("/ask")
    public ResponseEntity<ChatAskResponse> askQuestion(
        @AuthenticationPrincipal AuthenticatedUser user,
        @RequestBody ChatAskRequest incomingRequest
    ) {
        UUID sessionId = chatConversationService.ensureSession(user.getUserId(), incomingRequest.sessionId()).getId();

        // Get current user scope from AccessScopeService
        AccessScopeResponse scope = accessScopeService.currentScope();

        // Build user context from JWT user
        UserContext userContext = new UserContext(
            user.getUserId(),
            user.getUsername(), // getUsername() returns email
            user.getActiveRole()
        );

        // Build access scope with owned stores
        List<StoreInfo> ownedStores = new ArrayList<>();
        if (scope.ownedStoreIds() != null) {
            for (int i = 0; i < scope.ownedStoreIds().size(); i++) {
                UUID storeId = scope.ownedStoreIds().get(i);
                String storeName = scope.ownedStoreNames() != null && i < scope.ownedStoreNames().size()
                    ? scope.ownedStoreNames().get(i)
                    : "Store-" + storeId;
                ownedStores.add(new StoreInfo(storeId, storeName));
            }
        }
        AccessScope accessScope = new AccessScope(ownedStores);

        chatConversationService.appendUserMessage(user.getUserId(), sessionId, incomingRequest.message());
        List<ConversationMessage> trimmedConversation = chatConversationService.getConversationForAi(
            user.getUserId(),
            sessionId,
            incomingRequest.message()
        );

        // Create enriched request with current date
        ChatAskRequest enrichedRequest = new ChatAskRequest(
            sessionId,
            incomingRequest.message(),
            LocalDate.now(),
            userContext,
            accessScope,
            trimmedConversation
        );

        ChatAskResponse response = chatService.askQuestion(enrichedRequest);
        String assistantContent = response.answer() != null && !response.answer().isBlank()
            ? response.answer()
            : response.error() != null ? response.error().message() : null;
        chatConversationService.appendAssistantMessage(user.getUserId(), sessionId, assistantContent, response);
        return ResponseEntity.ok(response);
    }
}
