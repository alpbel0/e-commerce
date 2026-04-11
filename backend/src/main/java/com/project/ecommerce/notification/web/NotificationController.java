package com.project.ecommerce.notification.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.notification.dto.NotificationResponse;
import com.project.ecommerce.notification.service.NotificationService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/me")
    public ApiPageResponse<NotificationResponse> listMyNotifications(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return notificationService.listMyNotifications(page, size);
    }

    @PatchMapping("/{notificationId}/read")
    public NotificationResponse markAsRead(@PathVariable UUID notificationId) {
        return notificationService.markAsRead(notificationId);
    }
}
