package com.project.ecommerce.auth.service;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.security.AuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    private final AppUserRepository appUserRepository;

    public CurrentUserService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    public AuthenticatedUser requireAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
    }

    public AppUser requireCurrentAppUser() {
        AuthenticatedUser authenticatedUser = requireAuthenticatedUser();
        return appUserRepository.findById(authenticatedUser.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
