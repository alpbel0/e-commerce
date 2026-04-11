package com.project.ecommerce.auth.security;

import com.project.ecommerce.auth.domain.RoleType;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class AuthenticatedUser implements UserDetails {

    private final UUID userId;
    private final String email;
    private final String passwordHash;
    private final RoleType activeRole;
    private final boolean active;

    public AuthenticatedUser(UUID userId, String email, String passwordHash, RoleType activeRole, boolean active) {
        this.userId = userId;
        this.email = email;
        this.passwordHash = passwordHash;
        this.activeRole = activeRole;
        this.active = active;
    }

    public UUID getUserId() {
        return userId;
    }

    public RoleType getActiveRole() {
        return activeRole;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + activeRole.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
