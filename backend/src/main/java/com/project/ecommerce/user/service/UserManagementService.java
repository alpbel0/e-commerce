package com.project.ecommerce.user.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.user.dto.AdminUserListResponse;
import com.project.ecommerce.user.dto.CreateAdminUserRequest;
import com.project.ecommerce.user.dto.DeleteUserResponse;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import com.project.ecommerce.user.dto.UpdateUserRoleRequest;
import com.project.ecommerce.user.dto.UpdateUserStatusRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserManagementService {

    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;
    private final PasswordEncoder passwordEncoder;

    public UserManagementService(
        AppUserRepository appUserRepository,
        UserRoleRepository userRoleRepository,
        StoreRepository storeRepository,
        AuditLogService auditLogService,
        PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
        this.storeRepository = storeRepository;
        this.auditLogService = auditLogService;
        this.passwordEncoder = passwordEncoder;
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
        Pageable pageable = PageRequest.of(page, size);

        String normalizedQuery = q == null ? null : q.trim();
        if (normalizedQuery != null && normalizedQuery.isEmpty()) {
            normalizedQuery = null;
        }
        String queryPattern = normalizedQuery == null ? null : "%" + normalizedQuery.toLowerCase(Locale.ROOT) + "%";
        String roleFilter = role == null ? null : role.name();

        Page<AppUser> userPage = appUserRepository.findForAdminList(queryPattern, active, roleFilter, pageable);

        List<AdminUserListResponse> items = userPage.getContent().stream()
            .map(user -> {
                RoleType activeRole = resolveActiveRole(user);
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
    public AdminUserListResponse createUser(
        UUID currentUserId,
        CreateAdminUserRequest request
    ) {
        if (appUserRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        if (request.role() == RoleType.CORPORATE && (request.storeName() == null || request.storeName().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Store name is required for corporate accounts");
        }

        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEmailVerified(true);
        user.setActive(request.active() == null || request.active());
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        appUserRepository.save(user);

        UserRole userRole = new UserRole();
        userRole.setId(UUID.randomUUID());
        userRole.setUser(user);
        userRole.setRoleType(request.role());
        userRole.setActiveRole(true);
        userRoleRepository.save(userRole);

        if (request.role() == RoleType.CORPORATE) {
            Store store = new Store();
            store.setId(UUID.randomUUID());
            store.setOwner(user);
            store.setName(request.storeName().trim());
            store.setContactEmail(user.getEmail());
            store.setStatus(user.isActive() ? "OPEN" : "SUSPENDED");
            store.setSlug(generateSlug(request.storeName()));
            storeRepository.save(store);
        }

        AppUser actor = requireUser(currentUserId);
        auditLogService.log(
            actor,
            "ADMIN_USER_CREATED",
            Map.of(
                "userId", user.getId(),
                "email", user.getEmail(),
                "role", request.role().name(),
                "active", user.isActive()
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

        RoleType activeRole = resolveActiveRole(user);

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

        RoleType currentRole = resolveActiveRole(user);

        if (currentRole == RoleType.CORPORATE && request.role() != RoleType.CORPORATE) {
            boolean hasStores = !storeRepository.findByOwnerId(user.getId()).isEmpty();
            if (hasStores) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This user owns a store and cannot be demoted without reassigning or closing the store first."
                );
            }
        }

        userRoleRepository.findAllByUserIdAndActiveRoleTrue(user.getId())
            .forEach(existingRole -> existingRole.setActiveRole(false));

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

    @Transactional
    public DeleteUserResponse deleteUser(UUID currentUserId, UUID targetUserId) {
        if (currentUserId.equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own account");
        }

        AppUser targetUser = appUserRepository.findById(targetUserId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<UserRole> roles = new ArrayList<>(userRoleRepository.findByUserId(targetUserId));
        boolean isAdminUser = roles.stream().anyMatch(role -> role.getRoleType() == RoleType.ADMIN);
        if (isAdminUser && userRoleRepository.countActiveAdminUsers() <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot delete the last active admin");
        }

        targetUser.setActive(false);
        appUserRepository.save(targetUser);

        roles.forEach(role -> role.setActiveRole(false));
        userRoleRepository.saveAll(roles);

        List<Store> ownedStores = storeRepository.findByOwnerId(targetUserId);
        ownedStores.forEach(store -> store.setStatus("SUSPENDED"));
        if (!ownedStores.isEmpty()) {
            storeRepository.saveAll(ownedStores);
        }

        AppUser actor = requireUser(currentUserId);
        auditLogService.log(
            actor,
            "ADMIN_USER_DELETED",
            Map.of(
                "userId", targetUser.getId(),
                "email", targetUser.getEmail(),
                "suspendedStoreCount", ownedStores.size()
            )
        );

        return new DeleteUserResponse(
            targetUser.getId(),
            targetUser.isActive(),
            "User account deactivated successfully"
        );
    }

    private RoleType resolveActiveRole(AppUser user) {
        List<UserRole> activeRoles = userRoleRepository.findAllByUserIdAndActiveRoleTrue(user.getId());
        if (activeRoles.isEmpty()) {
            return RoleType.INDIVIDUAL;
        }
        return activeRoles.stream()
            .map(UserRole::getRoleType)
            .sorted((left, right) -> Integer.compare(rolePriority(left), rolePriority(right)))
            .findFirst()
            .orElse(RoleType.INDIVIDUAL);
    }

    private int rolePriority(RoleType roleType) {
        return switch (roleType) {
            case ADMIN -> 0;
            case CORPORATE -> 1;
            case INDIVIDUAL -> 2;
        };
    }

    private AppUser requireUser(UUID userId) {
        return appUserRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private String generateSlug(String name) {
        String slug = name.toLowerCase(Locale.ENGLISH)
            .replaceAll("[^a-z0-9\\s-]", "")
            .replaceAll("\\s+", "-")
            .replaceAll("-+", "-")
            .trim();
        return slug + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
