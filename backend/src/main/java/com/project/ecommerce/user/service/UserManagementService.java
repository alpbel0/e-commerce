package com.project.ecommerce.user.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.user.dto.AdminUserListResponse;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.store.repository.StoreRepository;
import com.project.ecommerce.user.dto.UpdateUserRoleRequest;
import com.project.ecommerce.user.dto.UpdateUserStatusRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserManagementService {

    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;

    public UserManagementService(
        AppUserRepository appUserRepository,
        UserRoleRepository userRoleRepository,
        StoreRepository storeRepository,
        AuditLogService auditLogService
    ) {
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
        this.storeRepository = storeRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public ApiPageResponse<AdminUserListResponse> listUsers(
        UUID currentUserId,
        String q,
        RoleType role,
        Boolean active,
        int page,
        int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("email").ascending());

        Page<AppUser> userPage = appUserRepository.searchUsers(q, pageable);

        List<AdminUserListResponse> items = userPage.getContent().stream()
            .filter(user -> {
                RoleType userRole = userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
                    .map(UserRole::getRoleType)
                    .orElse(null);

                boolean matchesRole = role == null || userRole == role;
                boolean matchesActive = active == null || user.isActive() == active;

                return matchesRole && matchesActive;
            })
            .map(user -> {
                RoleType activeRole = userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
                    .map(UserRole::getRoleType)
                    .orElse(RoleType.INDIVIDUAL);
                return new AdminUserListResponse(
                    user.getId(),
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    activeRole,
                    user.isActive()
                );
            })
            .toList();

        return new ApiPageResponse<>(
            items,
            userPage.getNumber(),
            userPage.getSize(),
            userPage.getTotalElements(),
            userPage.getTotalPages()
        );
    }

    @Transactional
    public AdminUserListResponse updateUserStatus(
        UUID currentUserId,
        UUID targetUserId,
        UpdateUserStatusRequest request
    ) {
        if (currentUserId.equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot change your own status");
        }

        AppUser user = appUserRepository.findById(targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        boolean oldStatus = user.isActive();
        user.setActive(request.active());
        appUserRepository.save(user);

        auditLogService.log(
            user,
            "USER_STATUS_UPDATED",
            Map.of(
                "userId", user.getId(),
                "oldStatus", oldStatus,
                "newStatus", user.isActive()
            )
        );

        RoleType activeRole = userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
            .map(UserRole::getRoleType)
            .orElse(RoleType.INDIVIDUAL);

        return new AdminUserListResponse(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName(),
            activeRole,
            user.isActive()
        );
    }

    @Transactional
    public AdminUserListResponse updateUserRole(
        UUID currentUserId,
        UUID targetUserId,
        UpdateUserRoleRequest request
    ) {
        if (currentUserId.equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot change your own role");
        }

        AppUser user = appUserRepository.findById(targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        RoleType currentRole = userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
            .map(UserRole::getRoleType)
            .orElse(null);

        if (currentRole == RoleType.CORPORATE && request.role() != RoleType.CORPORATE) {
            boolean hasStores = !storeRepository.findByOwnerId(user.getId()).isEmpty();
            if (hasStores) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This user owns a store and cannot be demoted without reassigning or closing the store first."
                );
            }
        }

        userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
            .ifPresent(existingRole -> existingRole.setActiveRole(false));

        userRoleRepository.findAll().stream()
            .filter(ur -> ur.getUser().getId().equals(user.getId()) && ur.getRoleType() == request.role())
            .findFirst()
            .ifPresentOrElse(
                existingRole -> existingRole.setActiveRole(true),
                () -> {
                    UserRole newRole = new UserRole();
                    newRole.setId(UUID.randomUUID());
                    newRole.setUser(user);
                    newRole.setRoleType(request.role());
                    newRole.setActiveRole(true);
                    userRoleRepository.save(newRole);
                }
            );

        auditLogService.log(
            user,
            "USER_ROLE_UPDATED",
            Map.of(
                "userId", user.getId(),
                "oldRole", currentRole != null ? currentRole.name() : "NONE",
                "newRole", request.role().name()
            )
        );

        return new AdminUserListResponse(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName(),
            request.role(),
            user.isActive()
        );
    }
}
