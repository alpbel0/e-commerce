package com.project.ecommerce.auth.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.TokenType;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.auth.dto.AuthResponse;
import com.project.ecommerce.auth.dto.ChangePasswordRequest;
import com.project.ecommerce.auth.dto.ForgotPasswordRequest;
import com.project.ecommerce.auth.dto.ForgotPasswordResponse;
import com.project.ecommerce.auth.dto.LoginRequest;
import com.project.ecommerce.auth.dto.MessageResponse;
import com.project.ecommerce.auth.dto.RefreshTokenRequest;
import com.project.ecommerce.auth.dto.RegisterRequest;
import com.project.ecommerce.auth.dto.ResetPasswordRequest;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import com.project.ecommerce.auth.security.JwtService;
import com.project.ecommerce.auditlog.service.AuditLogService;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;

    public AuthService(
        AppUserRepository appUserRepository,
        UserRoleRepository userRoleRepository,
        StoreRepository storeRepository,
        PasswordEncoder passwordEncoder,
        AuthenticationManager authenticationManager,
        JwtService jwtService,
        AuditLogService auditLogService
    ) {
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
        this.storeRepository = storeRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (request.role() == RoleType.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin registration is not allowed");
        }
        if (appUserRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        if (request.role() == RoleType.CORPORATE && (request.storeName() == null || request.storeName().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Store name is required for corporate accounts");
        }

        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setEmail(request.email().trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEmailVerified(true);
        user.setActive(true);
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
            store.setStatus("OPEN");
            storeRepository.save(store);
        }

        auditLogService.log(
            user,
            "AUTH_REGISTER",
            java.util.Map.of(
                "userId", user.getId(),
                "email", user.getEmail(),
                "role", request.role().name()
            )
        );

        AuthenticatedUser authenticatedUser = new AuthenticatedUser(
            user.getId(),
            user.getEmail(),
            user.getPasswordHash(),
            request.role(),
            user.isActive()
        );
        return buildAuthResponse(authenticatedUser, user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(), request.password())
        );

        AppUser user = appUserRepository.findByEmailIgnoreCase(request.email())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        UserRole activeRole = userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No active role found"));

        user.setLastLogin(LocalDateTime.now());
        appUserRepository.save(user);

        AuthenticatedUser authenticatedUser = new AuthenticatedUser(
            user.getId(),
            user.getEmail(),
            user.getPasswordHash(),
            activeRole.getRoleType(),
            user.isActive()
        );
        return buildAuthResponse(authenticatedUser, user);
    }

    public AuthResponse refresh(RefreshTokenRequest request) {
        String refreshToken = request.refreshToken();
        if (jwtService.extractTokenType(refreshToken) != TokenType.REFRESH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid refresh token");
        }

        AppUser user = appUserRepository.findByEmailIgnoreCase(jwtService.extractUsername(refreshToken))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        AuthenticatedUser authenticatedUser = new AuthenticatedUser(
            user.getId(),
            user.getEmail(),
            user.getPasswordHash(),
            jwtService.extractRole(refreshToken),
            user.isActive()
        );

        if (!jwtService.isTokenValid(refreshToken, authenticatedUser, TokenType.REFRESH)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is invalid or expired");
        }
        return buildAuthResponse(authenticatedUser, user);
    }

    public AuthResponse.UserProfileResponse me(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        AppUser user = appUserRepository.findById(authenticatedUser.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return new AuthResponse.UserProfileResponse(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName(),
            authenticatedUser.getActiveRole()
        );
    }

    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        AppUser user = appUserRepository.findByEmailIgnoreCase(request.email())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        RoleType role = userRoleRepository.findByUserIdAndActiveRoleTrue(user.getId())
            .map(UserRole::getRoleType)
            .orElse(RoleType.INDIVIDUAL);
        String resetToken = jwtService.generatePasswordResetToken(user.getId(), user.getEmail(), role);
        auditLogService.log(
            user,
            "AUTH_PASSWORD_RESET_REQUESTED",
            java.util.Map.of("userId", user.getId(), "email", user.getEmail())
        );
        return new ForgotPasswordResponse("Password reset token generated", resetToken);
    }

    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest request) {
        if (jwtService.extractTokenType(request.resetToken()) != TokenType.PASSWORD_RESET) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid reset token");
        }
        AppUser user = appUserRepository.findById(jwtService.extractUserId(request.resetToken()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        AuthenticatedUser authenticatedUser = new AuthenticatedUser(
            user.getId(),
            user.getEmail(),
            user.getPasswordHash(),
            jwtService.extractRole(request.resetToken()),
            user.isActive()
        );
        if (!jwtService.isTokenValid(request.resetToken(), authenticatedUser, TokenType.PASSWORD_RESET)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Reset token is invalid or expired");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        appUserRepository.save(user);
        auditLogService.log(
            user,
            "AUTH_PASSWORD_RESET_COMPLETED",
            java.util.Map.of("userId", user.getId(), "email", user.getEmail())
        );
        return new MessageResponse("Password updated successfully");
    }

    @Transactional
    public MessageResponse changePassword(AuthenticatedUser authenticatedUser, ChangePasswordRequest request) {
        if (authenticatedUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        AppUser user = appUserRepository.findById(authenticatedUser.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Old password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        appUserRepository.save(user);

        auditLogService.log(
            user,
            "PASSWORD_CHANGED",
            java.util.Map.of("userId", user.getId())
        );

        return new MessageResponse("Password changed successfully");
    }

    private AuthResponse buildAuthResponse(AuthenticatedUser authenticatedUser, AppUser user) {
        return new AuthResponse(
            jwtService.generateAccessToken(authenticatedUser),
            jwtService.generateRefreshToken(authenticatedUser),
            "Bearer",
            900L,
            new AuthResponse.UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                authenticatedUser.getActiveRole()
            )
        );
    }
}
