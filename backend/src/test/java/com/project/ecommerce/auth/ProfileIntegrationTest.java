package com.project.ecommerce.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class ProfileIntegrationTest {

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
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE audit_logs, stores, user_roles, users RESTART IDENTITY CASCADE");

        seedUser("user@test.local", "Test", "User", RoleType.INDIVIDUAL, "OldPass1!");
    }

    @Test
    void getMyProfileShouldReturnCurrentUserProfile() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        mockMvc.perform(get("/api/profiles/me")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("user@test.local"))
            .andExpect(jsonPath("$.firstName").value("Test"))
            .andExpect(jsonPath("$.lastName").value("User"))
            .andExpect(jsonPath("$.activeRole").value("INDIVIDUAL"));
    }

    @Test
    void updateProfileShouldUpdateAllowedFields() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "firstName": "UpdatedFirst",
              "lastName": "UpdatedLast",
              "phone": "+90-555-123-4567",
              "address": "Istanbul, Turkey"
            }
            """;

        mockMvc.perform(patch("/api/profiles/me")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("UpdatedFirst"))
            .andExpect(jsonPath("$.lastName").value("UpdatedLast"))
            .andExpect(jsonPath("$.phone").value("+90-555-123-4567"))
            .andExpect(jsonPath("$.address").value("Istanbul, Turkey"));
    }

    @Test
    void updateProfileWithEmptyFirstNameShouldFail() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "firstName": ""
            }
            """;

        mockMvc.perform(patch("/api/profiles/me")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void updateProfileShouldNotAffectEmailOrRole() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        AppUser user = appUserRepository.findByEmailIgnoreCase("user@test.local").orElseThrow();
        String originalEmail = user.getEmail();
        RoleType originalRole = RoleType.INDIVIDUAL;

        String body = """
            {
              "firstName": "NewFirst",
              "email": "hacked@evil.com",
              "activeRole": "ADMIN"
            }
            """;

        mockMvc.perform(patch("/api/profiles/me")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("NewFirst"))
            .andExpect(jsonPath("$.email").value(originalEmail))
            .andExpect(jsonPath("$.activeRole").value(originalRole.name()));
    }

    @Test
    void changePasswordWithCorrectOldPasswordShouldSucceed() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "oldPassword": "OldPass1!",
              "newPassword": "NewPassw0rd!"
            }
            """;

        mockMvc.perform(put("/api/auth/me/change-password")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Password changed successfully"));

        mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("user@test.local", "NewPassw0rd!"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("user@test.local"));
    }

    @Test
    void changePasswordWithWrongOldPasswordShouldFail() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "oldPassword": "WrongOldPass!",
              "newPassword": "NewPassw0rd!"
            }
            """;

        mockMvc.perform(put("/api/auth/me/change-password")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Old password is incorrect"));

        mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("user@test.local", "OldPass1!"))))
            .andExpect(status().isOk());
    }

    @Test
    void oldPasswordShouldNotWorkAfterChange() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "oldPassword": "OldPass1!",
              "newPassword": "NewPassw0rd!"
            }
            """;

        mockMvc.perform(put("/api/auth/me/change-password")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("user@test.local", "OldPass1!"))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void profileUpdateShouldCreateAuditLog() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "firstName": "AuditFirst",
              "lastName": "AuditLast"
            }
            """;

        mockMvc.perform(patch("/api/profiles/me")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        assertThat(auditLogRepository.findAll().stream()
            .anyMatch(log -> log.getAction().equals("PROFILE_UPDATED"))).isTrue();
    }

    @Test
    void passwordChangeShouldCreateAuditLog() throws Exception {
        String token = loginAndExtractAccessToken("user@test.local", "OldPass1!");

        String body = """
            {
              "oldPassword": "OldPass1!",
              "newPassword": "NewPassw0rd!"
            }
            """;

        mockMvc.perform(put("/api/auth/me/change-password")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        assertThat(auditLogRepository.findAll().stream()
            .anyMatch(log -> log.getAction().equals("PASSWORD_CHANGED"))).isTrue();
    }

    @Test
    void unauthenticatedRequestShouldReturnUnauthorized() throws Exception {
        mockMvc.perform(get("/api/profiles/me"))
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
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
            .andExpect(status().isOk())
            .andReturn();
        return objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
