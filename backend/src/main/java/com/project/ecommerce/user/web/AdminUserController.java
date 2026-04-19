package com.project.ecommerce.user.web;

import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.user.dto.AdminUserListResponse;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.user.dto.CreateAdminUserRequest;
import com.project.ecommerce.user.dto.DeleteUserResponse;
import com.project.ecommerce.user.dto.UpdateUserRoleRequest;
import com.project.ecommerce.user.dto.UpdateUserStatusRequest;
import com.project.ecommerce.user.service.UserManagementService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserManagementService userManagementService;

    public AdminUserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserListResponse createUser(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @Valid @RequestBody CreateAdminUserRequest request
    ) {
        return userManagementService.createUser(authenticatedUser.getUserId(), request);
    }

    @GetMapping
    public ApiPageResponse<AdminUserListResponse> listUsers(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) RoleType role,
        @RequestParam(required = false) Boolean active,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return userManagementService.listUsers(
            authenticatedUser.getUserId(),
            q,
            role,
            active,
            page,
            size
        );
    }

    @PatchMapping("/{userId}/status")
    public AdminUserListResponse updateUserStatus(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @PathVariable UUID userId,
        @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        return userManagementService.updateUserStatus(
            authenticatedUser.getUserId(),
            userId,
            request
        );
    }

    @PatchMapping("/{userId}/role")
    public AdminUserListResponse updateUserRole(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @PathVariable UUID userId,
        @Valid @RequestBody UpdateUserRoleRequest request
    ) {
        return userManagementService.updateUserRole(
            authenticatedUser.getUserId(),
            userId,
            request
        );
    }

    @DeleteMapping("/{userId}")
    public DeleteUserResponse deleteUser(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @PathVariable UUID userId
    ) {
        return userManagementService.deleteUser(authenticatedUser.getUserId(), userId);
    }
}
