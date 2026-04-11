package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.ProfileResponse;
import com.project.ecommerce.auth.dto.UpdateProfileRequest;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profiles")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/me")
    public ProfileResponse getMyProfile(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return profileService.getProfile(authenticatedUser);
    }

    @PatchMapping("/me")
    public ProfileResponse updateMyProfile(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @Valid @RequestBody UpdateProfileRequest request
    ) {
        return profileService.updateProfile(authenticatedUser, request);
    }
}
