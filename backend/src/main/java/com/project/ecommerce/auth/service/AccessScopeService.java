package com.project.ecommerce.auth.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.dto.AccessScopeResponse;
import com.project.ecommerce.auth.dto.AdminUserSummaryResponse;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.dto.StoreSummaryResponse;
import com.project.ecommerce.store.repository.StoreRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

@Service
public class AccessScopeService {

    private final CurrentUserService currentUserService;
    private final StoreRepository storeRepository;
    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;

    public AccessScopeService(
        CurrentUserService currentUserService,
        StoreRepository storeRepository,
        AppUserRepository appUserRepository,
        UserRoleRepository userRoleRepository
    ) {
        this.currentUserService = currentUserService;
        this.storeRepository = storeRepository;
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
    }

    public AccessScopeResponse currentScope() {
        AuthenticatedUser authenticatedUser = currentUserService.requireAuthenticatedUser();
        AppUser user = currentUserService.requireCurrentAppUser();
        List<Store> ownedStores = storeRepository.findByOwnerId(user.getId());
        return new AccessScopeResponse(
            user.getId(),
            user.getEmail(),
            authenticatedUser.getActiveRole(),
            ownedStores.stream().map(Store::getId).toList(),
            ownedStores.stream().map(Store::getName).toList()
        );
    }

    @PreAuthorize("hasRole('CORPORATE')")
    public List<StoreSummaryResponse> currentCorporateStores() {
        UUID userId = currentUserService.requireAuthenticatedUser().getUserId();
        return storeRepository.findByOwnerId(userId).stream()
            .map(store -> new StoreSummaryResponse(
                store.getId(),
                store.getName(),
                store.getContactEmail(),
                store.getStatus(),
                store.getProductCount(),
                store.getOwner() != null ? store.getOwner().getEmail() : null
            ))
            .toList();
    }

    @PreAuthorize("hasRole('INDIVIDUAL')")
    public AuthenticatedUser currentIndividualUser() {
        return currentUserService.requireAuthenticatedUser();
    }

    @PreAuthorize("hasRole('ADMIN')")
    public List<AdminUserSummaryResponse> allUsersForAdmin() {
        return appUserRepository.findAllByOrderByEmailAsc().stream()
            .map(user -> new AdminUserSummaryResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId()).map(role -> role.getRoleType()).orElse(RoleType.INDIVIDUAL),
                user.isActive()
            ))
            .toList();
    }
}
