package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.AuthResponse;
import com.project.ecommerce.auth.dto.ChangePasswordRequest;
import com.project.ecommerce.auth.dto.ForgotPasswordRequest;
import com.project.ecommerce.auth.dto.ForgotPasswordResponse;
import com.project.ecommerce.auth.dto.LoginRequest;
import com.project.ecommerce.auth.dto.MessageResponse;
import com.project.ecommerce.auth.dto.RefreshTokenRequest;
import com.project.ecommerce.auth.dto.RegisterRequest;
import com.project.ecommerce.auth.dto.ResetPasswordRequest;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.service.AuthService;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@SecurityRequirements
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refresh(request);
    }

    @GetMapping("/me")
    public AuthResponse.UserProfileResponse me(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
        return authService.me(authenticatedUser);
    }

    @PostMapping("/forgot-password")
    public ForgotPasswordResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return authService.forgotPassword(request);
    }

    @PostMapping("/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }

    @PutMapping("/me/change-password")
    public MessageResponse changePassword(
        @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
        @Valid @RequestBody ChangePasswordRequest request
    ) {
        return authService.changePassword(authenticatedUser, request);
    }
}
