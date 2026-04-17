package com.project.ecommerce.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.ecommerce.auth.domain.AppUser;
import com.project.ecommerce.auth.domain.RoleType;
import com.project.ecommerce.auth.domain.UserRole;
import com.project.ecommerce.auth.dto.LoginRequest;
import com.project.ecommerce.auth.repository.AppUserRepository;
import com.project.ecommerce.auth.repository.UserRoleRepository;
import com.project.ecommerce.auditlog.repository.AuditLogRepository;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminUserManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuditLogRepository auditLogRepository;

    private UUID adminUserId;
    private UUID normalUserId;
    private UUID corporateUserId;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE audit_logs, stores, user_roles, users RESTART IDENTITY CASCADE");

        AppUser admin = seedUser("admin@test.local", "Admin", "User", RoleType.ADMIN, "Adm1nPass!");
        adminUserId = admin.getId();

        AppUser normal = seedUser("normal@test.local", "Normal", "User", RoleType.INDIVIDUAL, "Norma1Pass!");
        normalUserId = normal.getId();

        AppUser corporate = seedUser("corporate@test.local", "Corp", "User", RoleType.CORPORATE, "CorpPass1!");
        corporateUserId = corporate.getId();

        Store store = new Store();
        store.setId(UUID.randomUUID());
        store.setOwner(corporate);
        store.setName("Corporate Store");
        store.setContactEmail(corporate.getEmail());
        store.setStatus("OPEN");
        storeRepository.save(store);
    }

    @Test
    void adminCanListUsers() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.items.length()").value(3))
            .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void adminCanFilterUsersByRole() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", bearer(token))
                .param("role", "INDIVIDUAL"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.items[0].activeRole").value("INDIVIDUAL"));
    }

    @Test
    void adminCanFilterActiveCorporateUsers() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", bearer(token))
                .param("role", "CORPORATE")
                .param("active", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].email").value("corporate@test.local"))
            .andExpect(jsonPath("$.items[0].activeRole").value("CORPORATE"))
            .andExpect(jsonPath("$.items[0].active").value(true));
    }

    @Test
    void adminCanFilterUsersByActiveStatus() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", bearer(token))
                .param("active", "true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void adminCanSearchUsersByEmail() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", bearer(token))
                .param("q", "admin"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].email").value("admin@test.local"));
    }

    @Test
    void nonAdminCannotAccessUserManagement() throws Exception {
        String token = loginAndExtractAccessToken("normal@test.local", "Norma1Pass!");

        mockMvc.perform(get("/api/admin/users")
                .header("Authorization", bearer(token)))
            .andExpect(status().isForbidden());
    }

    @Test
    void adminCanBanUser() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        String body = """
            { "active": false }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/status", normalUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        assertThat(auditLogRepository.findAll().stream()
            .anyMatch(log -> log.getAction().equals("USER_STATUS_UPDATED"))).isTrue();
    }

    @Test
    void adminCanUnbanUser() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        AppUser user = appUserRepository.findById(normalUserId).orElseThrow();
        user.setActive(false);
        appUserRepository.save(user);

        String body = """
            { "active": true }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/status", normalUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void adminCannotBanSelf() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        String body = """
            { "active": false }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/status", adminUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("You cannot change your own status"));
    }

    @Test
    void adminCanChangeUserRole() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        String body = """
            { "role": "CORPORATE" }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/role", normalUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.activeRole").value("CORPORATE"));

        assertThat(auditLogRepository.findAll().stream()
            .anyMatch(log -> log.getAction().equals("USER_ROLE_UPDATED"))).isTrue();
    }

    @Test
    void adminCannotChangeOwnRole() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        String body = """
            { "role": "INDIVIDUAL" }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/role", adminUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("You cannot change your own role"));
    }

    @Test
    void adminCannotDemoteStoreOwnerToNonCorporate() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        String body = """
            { "role": "INDIVIDUAL" }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/role", corporateUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(
                "This user owns a store and cannot be demoted without reassigning or closing the store first."));
    }

    @Test
    void adminCanDemoteCorporateUserWithoutStore() throws Exception {
        Store store = storeRepository.findByOwnerId(corporateUserId).get(0);
        storeRepository.delete(store);

        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        String body = """
            { "role": "INDIVIDUAL" }
            """;

        mockMvc.perform(patch("/api/admin/users/{userId}/role", corporateUserId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.activeRole").value("INDIVIDUAL"));
    }

    @Test
    void unauthenticatedRequestToUserManagementIsRejected() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
            .andExpect(status().isUnauthorized());
    }

    private AppUser seedUser(String email, String firstName, String lastName, RoleType roleType, String password) {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setEmailVerified(true);
        user.setActive(true);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        AppUser savedUser = appUserRepository.save(user);

        UserRole userRole = new UserRole();
        userRole.setId(UUID.randomUUID());
        userRole.setUser(savedUser);
        userRole.setRoleType(roleType);
        userRole.setActiveRole(true);
        userRoleRepository.save(userRole);
        return savedUser;
    }

    private String loginAndExtractAccessToken(String email, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/login")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(loginResult.getResponse().getContentAsString())
            .get("accessToken").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
