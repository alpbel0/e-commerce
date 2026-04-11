package com.project.ecommerce.auth.seed;

import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("!test")
public class DemoAccountSeeder implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final UserRoleRepository userRoleRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;

    public DemoAccountSeeder(
        AppUserRepository appUserRepository,
        UserRoleRepository userRoleRepository,
        StoreRepository storeRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.userRoleRepository = userRoleRepository;
        this.storeRepository = storeRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        seedUser("admin@local.test", "Admin", "User", RoleType.ADMIN, null);
        AppUser corporate = seedUser("corporate@local.test", "Corporate", "Owner", RoleType.CORPORATE, "Demo Corporate Store");
        seedUser("individual@local.test", "Individual", "User", RoleType.INDIVIDUAL, null);

        if (corporate != null && storeRepository.findByOwnerId(corporate.getId()).stream().noneMatch(store -> "Second Demo Store".equals(store.getName()))) {
            Store secondStore = new Store();
            secondStore.setId(UUID.randomUUID());
            secondStore.setOwner(corporate);
            secondStore.setName("Second Demo Store");
            secondStore.setContactEmail(corporate.getEmail());
            secondStore.setStatus("OPEN");
            storeRepository.save(secondStore);
        }
    }

    private AppUser seedUser(String email, String firstName, String lastName, RoleType roleType, String initialStoreName) {
        AppUser user = appUserRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            AppUser newUser = new AppUser();
            newUser.setId(UUID.randomUUID());
            newUser.setEmail(email);
            newUser.setPasswordHash(passwordEncoder.encode("Passw0rd!"));
            newUser.setEmailVerified(true);
            newUser.setActive(true);
            newUser.setFirstName(firstName);
            newUser.setLastName(lastName);
            return appUserRepository.save(newUser);
        });

        if (!userRoleRepository.existsByUserIdAndRoleType(user.getId(), roleType)) {
            UserRole userRole = new UserRole();
            userRole.setId(UUID.randomUUID());
            userRole.setUser(user);
            userRole.setRoleType(roleType);
            userRole.setActiveRole(true);
            userRoleRepository.save(userRole);
        }

        if (roleType == RoleType.CORPORATE && initialStoreName != null
            && storeRepository.findByOwnerId(user.getId()).stream().noneMatch(store -> initialStoreName.equals(store.getName()))) {
            Store store = new Store();
            store.setId(UUID.randomUUID());
            store.setOwner(user);
            store.setName(initialStoreName);
            store.setContactEmail(user.getEmail());
            store.setStatus("OPEN");
            storeRepository.save(store);
        }

        return user;
    }
}
