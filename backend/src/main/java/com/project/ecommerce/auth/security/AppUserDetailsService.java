package com.project.ecommerce.auth.security;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import java.util.Comparator;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AppUserDetailsService implements UserDetailsService {

    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;

    public AppUserDetailsService(AppUserRepository appUserRepository, UserRoleRepository userRoleRepository) {
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
    }

    @Override
    public AuthenticatedUser loadUserByUsername(String username) {
        AppUser user = appUserRepository.findByEmailIgnoreCase(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        UserRole activeRole = userRoleRepository.findByUserId(user.getId())
            .stream()
            .max(Comparator.comparing(UserRole::isActiveRole))
            .orElseThrow(() -> new UsernameNotFoundException("Active role not found"));

        return new AuthenticatedUser(user.getId(), user.getEmail(), user.getPasswordHash(), activeRole.getRoleType(), user.isActive());
    }
}
