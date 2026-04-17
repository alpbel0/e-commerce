package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.AuthResponse;
import com.project.ecommerce.auth.dto.UpdateProfileRequest;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.AuthService;
import com.project.ecommerce.auth.service.AccessScopeService;
import com.project.ecommerce.auth.service.ProfileService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/individual")
@SecurityRequirement(name = "bearerAuth")
public class IndividualProfileController {

    private final AccessScopeService accessScopeService;
    private final AuthService authService;
    private final ProfileService profileService;

    public IndividualProfileController(
            AccessScopeService accessScopeService,
            AuthService authService,
            ProfileService profileService
    ) {
        this.accessScopeService = accessScopeService;
        this.authService = authService;
        this.profileService = profileService;
    }

    @GetMapping("/profile")
    public AuthResponse.UserProfileResponse profile() {
        AuthenticatedUser authenticatedUser = accessScopeService.currentIndividualUser();
        return authService.me(authenticatedUser);
    }

    @PatchMapping("/profile")
    public AuthResponse.UserProfileResponse updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        AuthenticatedUser authenticatedUser = accessScopeService.currentIndividualUser();
        profileService.updateProfile(authenticatedUser, request);
        return authService.me(authenticatedUser);
    }
}
