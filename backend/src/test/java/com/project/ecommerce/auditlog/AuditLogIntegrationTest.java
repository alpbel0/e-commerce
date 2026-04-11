package com.project.ecommerce.auditlog;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.project.ecommerce.category.domain.Category;
import com.project.ecommerce.category.repository.CategoryRepository;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.math.BigDecimal;
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
class AuditLogIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ProductRepository productRepository;

    private Product product;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("""
            TRUNCATE TABLE
                audit_logs,
                notifications,
                review_responses,
                reviews,
                shipments,
                order_items,
                orders,
                cart_store_coupons,
                cart_items,
                carts,
                coupons,
                products,
                categories,
                stores,
                user_roles,
                users
            RESTART IDENTITY CASCADE
            """);

        AppUser admin = seedUser("admin@test.local", RoleType.ADMIN, "Adm1nPass!");
        AppUser corporate = seedUser("corporate@test.local", RoleType.CORPORATE, "CorpPass1!");
        seedUser("individual@test.local", RoleType.INDIVIDUAL, "IndPass1!");

        Category category = seedCategory("Audit", "audit");
        Store store = seedStore(corporate, "Audit Store");
        product = seedProduct(store, category, "AUD-1", "Audit Product");
    }

    @Test
    void adminShouldListAndReadAuditLogsWithActionFilter() throws Exception {
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(patch("/api/products/{productId}", product.getId())
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"Audit Product Updated"}
                    """))
            .andExpect(status().isOk());

        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");
        MvcResult listResult = mockMvc.perform(get("/api/audit-logs")
                .header("Authorization", bearer(adminToken))
                .param("action", "PRODUCT_UPDATED"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].action").value("PRODUCT_UPDATED"))
            .andExpect(jsonPath("$.items[0].actorUserEmail").value("corporate@test.local"))
            .andReturn();

        String auditLogId = readJson(listResult).get("items").get(0).get("id").asText();

        mockMvc.perform(get("/api/audit-logs/{auditLogId}", auditLogId)
                .header("Authorization", bearer(adminToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.action").value("PRODUCT_UPDATED"))
            .andExpect(jsonPath("$.details").value(org.hamcrest.Matchers.containsString(product.getId().toString())));
    }

    @Test
    void nonAdminShouldNotAccessAuditLogs() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(get("/api/audit-logs")
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    private AppUser seedUser(String email, RoleType roleType, String password) {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setEmailVerified(true);
        user.setActive(true);
        user.setFirstName(roleType.name());
        user.setLastName("User");
        AppUser savedUser = appUserRepository.save(user);

        UserRole role = new UserRole();
        role.setId(UUID.randomUUID());
        role.setUser(savedUser);
        role.setRoleType(roleType);
        role.setActiveRole(true);
        userRoleRepository.save(role);
        return savedUser;
    }

    private Category seedCategory(String name, String slug) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setName(name);
        category.setSlug(slug);
        category.setDescription(name);
        category.setDisplayOrder(1);
        category.setLevel(0);
        category.setActive(true);
        return categoryRepository.save(category);
    }

    private Store seedStore(AppUser owner, String name) {
        Store store = new Store();
        store.setId(UUID.randomUUID());
        store.setOwner(owner);
        store.setName(name);
        store.setContactEmail(owner.getEmail());
        store.setStatus("OPEN");
        return storeRepository.save(store);
    }

    private Product seedProduct(Store store, Category category, String sku, String title) {
        Product seededProduct = new Product();
        seededProduct.setId(UUID.randomUUID());
        seededProduct.setStore(store);
        seededProduct.setCategory(category);
        seededProduct.setSku(sku);
        seededProduct.setTitle(title);
        seededProduct.setDescription(title);
        seededProduct.setBrand("Codex");
        seededProduct.setUnitPrice(new BigDecimal("99.90"));
        seededProduct.setStockQuantity(10);
        seededProduct.setReviewCount(0);
        seededProduct.setTotalSales(0);
        seededProduct.setActive(true);
        return productRepository.save(seededProduct);
    }

    private String loginAndExtractAccessToken(String email, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
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
