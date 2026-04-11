package com.project.ecommerce.notification.repository;

import com.project.ecommerce.notification.domain.Notification;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @EntityGraph(attributePaths = {"order", "recipientUser"})
    Page<Notification> findByRecipientUserIdOrderByCreatedAtDesc(UUID recipientUserId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"order", "recipientUser"})
    Optional<Notification> findById(UUID id);

    @EntityGraph(attributePaths = {"order", "recipientUser"})
    List<Notification> findByRecipientUserIdAndReadFalse(UUID recipientUserId);
}
