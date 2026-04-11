package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.AuthResponse;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.AuthService;
import com.project.ecommerce.auth.service.AccessScopeService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/individual")
@SecurityRequirement(name = "bearerAuth")
public class IndividualProfileController {

    private final AccessScopeService accessScopeService;
    private final AuthService authService;

    public IndividualProfileController(AccessScopeService accessScopeService, AuthService authService) {
        this.accessScopeService = accessScopeService;
        this.authService = authService;
    }

    @GetMapping("/profile")
    public AuthResponse.UserProfileResponse profile() {
        AuthenticatedUser authenticatedUser = accessScopeService.currentIndividualUser();
        return authService.me(authenticatedUser);
    }
}
