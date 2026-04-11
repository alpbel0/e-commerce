package com.project.ecommerce.auth.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.auth.dto.ProfileResponse;
import com.project.ecommerce.auth.dto.UpdateProfileRequest;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auditlog.service.AuditLogService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {

    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;
    private final AuditLogService auditLogService;

    public ProfileService(
        AppUserRepository appUserRepository,
        UserRoleRepository userRoleRepository,
        AuditLogService auditLogService
    ) {
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public ProfileResponse updateProfile(AuthenticatedUser authenticatedUser, UpdateProfileRequest request) {
        AppUser user = appUserRepository.findById(authenticatedUser.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (request.firstName() != null && !request.firstName().isBlank()) {
            user.setFirstName(request.firstName().trim());
        }
        if (request.lastName() != null && !request.lastName().isBlank()) {
            user.setLastName(request.lastName().trim());
        }
        if (request.phone() != null) {
            user.setPhone(request.phone().isBlank() ? null : request.phone().trim());
        }
        if (request.address() != null) {
            user.setAddress(request.address().isBlank() ? null : request.address().trim());
        }
        if (request.profileImageUrl() != null) {
            user.setProfileImageUrl(request.profileImageUrl().isBlank() ? null : request.profileImageUrl().trim());
        }

        appUserRepository.save(user);

        List<String> updatedFields = new ArrayList<>();
        if (request.firstName() != null) updatedFields.add("firstName");
        if (request.lastName() != null) updatedFields.add("lastName");
        if (request.phone() != null) updatedFields.add("phone");
        if (request.address() != null) updatedFields.add("address");
        if (request.profileImageUrl() != null) updatedFields.add("profileImageUrl");

        auditLogService.log(
            user,
            "PROFILE_UPDATED",
            Map.of(
                "userId", user.getId(),
                "updatedFields", updatedFields
            )
        );

        return toProfileResponse(user, authenticatedUser.getActiveRole());
    }

    public ProfileResponse getProfile(AuthenticatedUser authenticatedUser) {
        AppUser user = appUserRepository.findById(authenticatedUser.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toProfileResponse(user, authenticatedUser.getActiveRole());
    }

    private ProfileResponse toProfileResponse(AppUser user, RoleType activeRole) {
        return new ProfileResponse(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName(),
            user.getPhone(),
            user.getAddress(),
            user.getProfileImageUrl(),
            activeRole,
            user.isActive()
        );
    }
}
