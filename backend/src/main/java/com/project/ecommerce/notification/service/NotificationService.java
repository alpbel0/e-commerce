package com.project.ecommerce.notification.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.service.CurrentUserService;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.notification.domain.Notification;
import com.project.ecommerce.notification.dto.MarkAsReadResponse;
import com.project.ecommerce.notification.dto.NotificationResponse;
import com.project.ecommerce.notification.repository.NotificationRepository;
import com.project.ecommerce.order.domain.Order;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotificationService {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final NotificationRepository notificationRepository;
    private final CurrentUserService currentUserService;
    private final EmailService emailService;

    public NotificationService(
        NotificationRepository notificationRepository,
        CurrentUserService currentUserService,
        EmailService emailService
    ) {
        this.notificationRepository = notificationRepository;
        this.currentUserService = currentUserService;
        this.emailService = emailService;
    }

    @PreAuthorize("isAuthenticated()")
    public ApiPageResponse<NotificationResponse> listMyNotifications(Integer page, Integer size) {
        AppUser currentUser = currentUserService.requireCurrentAppUser();
        Pageable pageable = PageRequest.of(
            page == null ? DEFAULT_PAGE : Math.max(page, 0),
            size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE),
            Sort.by(Sort.Direction.DESC, "createdAt")
        );
        var notificationPage = notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(currentUser.getId(), pageable);
        var items = notificationPage.stream().map(this::toResponse).toList();
        return new ApiPageResponse<>(items, notificationPage.getNumber(), notificationPage.getSize(), notificationPage.getTotalElements(), notificationPage.getTotalPages());
    }

    @Transactional
    @PreAuthorize("isAuthenticated()")
    public NotificationResponse markAsRead(UUID notificationId) {
        AppUser currentUser = currentUserService.requireCurrentAppUser();
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        if (!notification.getRecipientUser().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
        }
        return toResponse(notification);
    }

    @Transactional
    @PreAuthorize("isAuthenticated()")
    public MarkAsReadResponse markAllAsRead() {
        AppUser currentUser = currentUserService.requireCurrentAppUser();
        var unreadNotifications = notificationRepository.findByRecipientUserIdAndReadFalse(currentUser.getId());
        if (unreadNotifications.isEmpty()) {
            return new MarkAsReadResponse(0);
        }

        LocalDateTime now = LocalDateTime.now();
        unreadNotifications.forEach(notification -> {
            notification.setRead(true);
            notification.setReadAt(now);
        });
        return new MarkAsReadResponse(unreadNotifications.size());
    }

    @Transactional
    public void createOrderNotification(AppUser recipientUser, Order order, String type, String title, String message) {
        createNotification(recipientUser, order, type, title, message);
    }

    @Transactional
    public void createNotification(AppUser recipientUser, String type, String title, String message) {
        createNotification(recipientUser, null, type, title, message);
    }

    @Transactional
    public void createNotification(AppUser recipientUser, Order order, String type, String title, String message) {
        Notification notification = new Notification();
        notification.setId(UUID.randomUUID());
        notification.setRecipientUser(recipientUser);
        notification.setOrder(order);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setRead(false);
        notificationRepository.save(notification);

        if (recipientUser.getEmail() != null && !recipientUser.getEmail().isBlank()) {
            emailService.send(recipientUser.getEmail(), title, message);
        }
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
            notification.getId(),
            notification.getType(),
            notification.getTitle(),
            notification.getMessage(),
            notification.isRead(),
            notification.getReadAt(),
            notification.getCreatedAt(),
            notification.getOrder() == null ? null : notification.getOrder().getId(),
            notification.getOrder() == null ? null : notification.getOrder().getIncrementId()
        );
    }
}
