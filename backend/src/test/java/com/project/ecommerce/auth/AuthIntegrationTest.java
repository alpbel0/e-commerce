package com.project.ecommerce.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class AuthIntegrationTest {

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

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE stores, user_roles, users RESTART IDENTITY CASCADE");

        seedUser("admin@test.local", "Admin", "User", RoleType.ADMIN, "Adm1nPass!");
        AppUser corporate = seedUser("corporate@test.local", "Corporate", "Owner", RoleType.CORPORATE, "CorpPass1!");
        seedStore(corporate, "Corporate Primary Store");
        seedStore(corporate, "Corporate Secondary Store");
        seedUser("individual@test.local", "Individual", "User", RoleType.INDIVIDUAL, "IndPass1!");
    }

    @Test
    void registerIndividualShouldSucceed() throws Exception {
        String body = """
            {
              "email": "registered.individual@test.local",
              "firstName": "Registered",
              "lastName": "Individual",
              "password": "Passw0rd!",
              "role": "INDIVIDUAL"
            }
            """;

        mockMvc.perform(post("/api/auth/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("registered.individual@test.local"))
            .andExpect(jsonPath("$.user.activeRole").value("INDIVIDUAL"))
            .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void registerCorporateShouldCreateStore() throws Exception {
        String body = """
            {
              "email": "registered.corporate@test.local",
              "firstName": "Registered",
              "lastName": "Corporate",
              "password": "Passw0rd!",
              "role": "CORPORATE",
              "storeName": "Registered Corporate Store"
            }
            """;

        mockMvc.perform(post("/api/auth/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.activeRole").value("CORPORATE"));

        AppUser corporate = appUserRepository.findByEmailIgnoreCase("registered.corporate@test.local").orElseThrow();
        assertThat(storeRepository.findByOwnerId(corporate.getId()))
            .anySatisfy(store -> {
                assertThat(store.getName()).isEqualTo("Registered Corporate Store");
                assertThat(store.getSlug()).startsWith("registered-corporate-store-");
            });
    }

    @Test
    void loginShouldSucceed() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("admin@test.local", "Adm1nPass!"));

        mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("admin@test.local"))
            .andExpect(jsonPath("$.user.activeRole").value("ADMIN"))
            .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    @Test
    void loginWithWrongPasswordShouldFail() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("admin@test.local", "WrongPass1!"));

        mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Authentication failed"));
    }

    @Test
    void refreshShouldReturnNewAccessToken() throws Exception {
        String loginBody = objectMapper.writeValueAsString(new LoginRequest("corporate@test.local", "CorpPass1!"));
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn();

        String refreshToken = readJson(loginResult).get("refreshToken").asText();

        mockMvc.perform(post("/api/auth/refresh").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"refreshToken":"%s"}
                    """.formatted(refreshToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.activeRole").value("CORPORATE"))
            .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void meEndpointShouldReturnCurrentUser() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("individual@test.local"))
            .andExpect(jsonPath("$.activeRole").value("INDIVIDUAL"));
    }

    @Test
    void protectedEndpointWithoutTokenShouldReturnUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Authentication required"));
    }

    @Test
    void corporateEndpointShouldRejectIndividualRole() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(get("/api/corporate/stores")
                .header("Authorization", bearer(token)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void forgotAndResetPasswordShouldAllowLoginWithNewPassword() throws Exception {
        MvcResult forgotResult = mockMvc.perform(post("/api/auth/forgot-password").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"individual@test.local"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.resetToken").isNotEmpty())
            .andReturn();

        String resetToken = readJson(forgotResult).get("resetToken").asText();

        mockMvc.perform(post("/api/auth/reset-password").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"resetToken":"%s","newPassword":"NewPassw0rd!"}
                    """.formatted(resetToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Password updated successfully"));

        mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("individual@test.local", "NewPassw0rd!"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("individual@test.local"));
    }

    @Test
    void registerValidationShouldReturnFieldErrors() throws Exception {
        mockMvc.perform(post("/api/auth/register").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors").isArray())
            .andExpect(jsonPath("$.fieldErrors[0].field").exists());
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

    private void seedStore(AppUser owner, String name) {
        Store store = new Store();
        store.setId(UUID.randomUUID());
        store.setOwner(owner);
        store.setName(name);
        store.setContactEmail(owner.getEmail());
        store.setStatus("OPEN");
        store.setSlug(name.toLowerCase(java.util.Locale.ENGLISH).replaceAll("\\s+", "-") + "-" + UUID.randomUUID().toString().substring(0, 8));
        storeRepository.save(store);
    }

    private String loginAndExtractAccessToken(String email, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
            .andExpect(status().isOk())
            .andReturn();
        return readJson(loginResult).get("accessToken").asText();
    }

    private JsonNode readJson(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
