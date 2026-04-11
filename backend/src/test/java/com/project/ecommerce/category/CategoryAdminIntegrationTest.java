package com.project.ecommerce.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class CategoryAdminIntegrationTest {

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
    private CategoryRepository categoryRepository;

    @Autowired
    private StoreRepository storeRepository;

    @Autowired
    private ProductRepository productRepository;

    private Category rootCategory;

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

        seedUser("admin@test.local", RoleType.ADMIN, "Adm1nPass!");
        AppUser individual = seedUser("individual@test.local", RoleType.INDIVIDUAL, "IndPass1!");
        AppUser corporate = seedUser("corporate@test.local", RoleType.CORPORATE, "CorpPass1!");

        rootCategory = seedCategory("Electronics", "electronics", null, 0, true);
        Store store = seedStore(corporate, "Category Store");
        seedProduct(store, rootCategory, "CAT-1", "Category Product");
    }

    @Test
    void adminShouldCreateUpdateAndSoftDeleteCategoryWithAuditTrail() throws Exception {
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        MvcResult createResult = mockMvc.perform(post("/api/admin/categories")
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name":"Gaming Laptops",
                      "description":"Portable performance",
                      "displayOrder":3,
                      "parentId":"%s",
                      "active":true
                    }
                    """.formatted(rootCategory.getId())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Gaming Laptops"))
            .andExpect(jsonPath("$.slug").value("gaming-laptops"))
            .andExpect(jsonPath("$.parentId").value(rootCategory.getId().toString()))
            .andExpect(jsonPath("$.level").value(1))
            .andReturn();

        String categoryId = readJson(createResult).get("id").asText();

        mockMvc.perform(patch("/api/admin/categories/{categoryId}", categoryId)
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name":"Gaming Notebook",
                      "active":true
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Gaming Notebook"))
            .andExpect(jsonPath("$.slug").value("gaming-notebook"));

        mockMvc.perform(delete("/api/admin/categories/{categoryId}", categoryId)
                .header("Authorization", bearer(adminToken)))
            .andExpect(status().isNoContent());

        assertThat(categoryRepository.findById(UUID.fromString(categoryId))).get()
            .extracting(Category::isActive)
            .isEqualTo(false);

        mockMvc.perform(get("/api/categories")
                .header("Authorization", bearer(adminToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].name").value("Electronics"));

        mockMvc.perform(get("/api/audit-logs")
                .header("Authorization", bearer(adminToken))
                .param("action", "CATEGORY_CREATED"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].action").value("CATEGORY_CREATED"));

        mockMvc.perform(get("/api/audit-logs")
                .header("Authorization", bearer(adminToken))
                .param("action", "CATEGORY_UPDATED"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void nonAdminShouldNotManageCategories() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/admin/categories")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name":"Blocked",
                      "active":true
                    }
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void slugShouldBeGeneratedUniquely() throws Exception {
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(post("/api/admin/categories")
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name":"Audio Devices",
                      "active":true
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.slug").value("audio-devices"));

        mockMvc.perform(post("/api/admin/categories")
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name":"Audio Devices",
                      "active":true
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.slug").value("audio-devices-2"));
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

    private Category seedCategory(String name, String slug, Category parent, int level, boolean active) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setName(name);
        category.setSlug(slug);
        category.setDescription(name);
        category.setParent(parent);
        category.setDisplayOrder(1);
        category.setLevel(level);
        category.setActive(active);
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
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setStore(store);
        product.setCategory(category);
        product.setSku(sku);
        product.setTitle(title);
        product.setDescription(title);
        product.setBrand("Codex");
        product.setUnitPrice(new BigDecimal("99.90"));
        product.setStockQuantity(10);
        product.setReviewCount(0);
        product.setTotalSales(0);
        product.setActive(true);
        return productRepository.save(product);
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
