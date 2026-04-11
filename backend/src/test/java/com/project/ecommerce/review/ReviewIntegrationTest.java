package com.project.ecommerce.review;

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
import com.project.ecommerce.order.domain.Order;
import com.project.ecommerce.order.domain.OrderItem;
import com.project.ecommerce.order.repository.OrderItemRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.review.repository.ReviewRepository;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
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
class ReviewIntegrationTest {

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

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    private AppUser individualUser;
    private AppUser corporateUser;
    private AppUser foreignCorporateUser;
    private Product product;
    private Product foreignProduct;
    private Order deliveredOrder;
    private Order secondDeliveredOrder;
    private Order pendingOrder;

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

        Category category = seedCategory("Reviews", "reviews");
        individualUser = seedUser("individual@test.local", RoleType.INDIVIDUAL, "IndPass1!");
        corporateUser = seedUser("corporate@test.local", RoleType.CORPORATE, "CorpPass1!");
        foreignCorporateUser = seedUser("foreign.corporate@test.local", RoleType.CORPORATE, "CorpPass1!");

        Store store = seedStore(corporateUser, "Review Store");
        Store foreignStore = seedStore(foreignCorporateUser, "Foreign Review Store");
        product = seedProduct(store, category, "RV-1", "Reviewable Product");
        foreignProduct = seedProduct(foreignStore, category, "RV-2", "Foreign Product");
        deliveredOrder = seedOrderWithItem(individualUser, store, product, "DELIVERED");
        secondDeliveredOrder = seedOrderWithItem(individualUser, store, product, "DELIVERED");
        pendingOrder = seedOrderWithItem(individualUser, store, product, "PENDING");
    }

    @Test
    void individualShouldCreateVerifiedReviewAndUpdateProductMetrics() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(deliveredOrder.getId(), product.getId(), 5, "Great Product", "Works exactly as expected.")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.verifiedPurchase").value(true))
            .andExpect(jsonPath("$.starRating").value(5))
            .andExpect(jsonPath("$.responses.length()").value(0));

        Product refreshed = productRepository.findById(product.getId()).orElseThrow();
        assertThat(refreshed.getReviewCount()).isEqualTo(1);
        assertThat(refreshed.getAvgRating()).isEqualByComparingTo(new BigDecimal("5.00"));
    }

    @Test
    void duplicateReviewForSameProductShouldBeRejectedEvenAcrossDifferentOrders() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(deliveredOrder.getId(), product.getId(), 4, "First Review", "Solid.")))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(secondDeliveredOrder.getId(), product.getId(), 5, "Second Review", "Better now.")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("You already have an active review for this product"));
    }

    @Test
    void reviewShouldRequireVerifiedPurchase() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(deliveredOrder.getId(), foreignProduct.getId(), 3, "No Purchase", "Should fail.")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Review requires a verified purchase for the selected order and product"));
    }

    @Test
    void reviewShouldRequireDeliveredOrder() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(pendingOrder.getId(), product.getId(), 3, "Pending", "Not delivered yet.")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Review requires a delivered order"));
    }

    @Test
    void corporateShouldRespondOnlyOnceAndOnlyForOwnStore() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");
        String reviewId = createReviewAndReturnId(individualToken, deliveredOrder.getId(), product.getId(), 4, "Helpful", "Pretty good.");
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(post("/api/reviews/{reviewId}/responses", reviewId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"responseText":"Thank you for the feedback."}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.responseText").value("Thank you for the feedback."));

        mockMvc.perform(post("/api/reviews/{reviewId}/responses", reviewId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"responseText":"Second response should fail."}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("This review already has an active seller response"));

        String foreignCorporateToken = loginAndExtractAccessToken("foreign.corporate@test.local", "CorpPass1!");
        mockMvc.perform(post("/api/reviews/{reviewId}/responses", reviewId)
                .header("Authorization", bearer(foreignCorporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"responseText":"I should not be able to do this."}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You can only respond to reviews for your own store"));
    }

    @Test
    void editingReviewShouldInvalidateSellerResponseAndRecalculateProductMetrics() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");
        String reviewId = createReviewAndReturnId(individualToken, deliveredOrder.getId(), product.getId(), 1, "Bad", "Not happy.");
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(post("/api/reviews/{reviewId}/responses", reviewId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"responseText":"We are sorry."}
                    """))
            .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/reviews/{reviewId}", reviewId)
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "starRating": 5,
                      "reviewTitle": "Updated",
                      "reviewText": "Issue solved.",
                      "reviewImages": []
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.starRating").value(5))
            .andExpect(jsonPath("$.responses.length()").value(0));

        Product refreshed = productRepository.findById(product.getId()).orElseThrow();
        assertThat(refreshed.getReviewCount()).isEqualTo(1);
        assertThat(refreshed.getAvgRating()).isEqualByComparingTo(new BigDecimal("5.00"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from review_responses where review_id = ? and is_active = true", Integer.class, UUID.fromString(reviewId)))
            .isEqualTo(0);
        assertThat(jdbcTemplate.queryForObject("select count(*) from notifications where recipient_user_id = ?", Integer.class, corporateUser.getId()))
            .isEqualTo(1);

        mockMvc.perform(post("/api/reviews/{reviewId}/responses", reviewId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"responseText":"Thanks for updating the review."}
                    """))
            .andExpect(status().isCreated());
    }

    @Test
    void softDeletingReviewShouldHideItAllowReplacementAndRecalculateMetrics() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");
        String reviewId = createReviewAndReturnId(individualToken, deliveredOrder.getId(), product.getId(), 2, "Weak", "Could be better.");

        mockMvc.perform(delete("/api/reviews/{reviewId}", reviewId)
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/reviews/{reviewId}", reviewId)
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isNotFound());

        Product refreshed = productRepository.findById(product.getId()).orElseThrow();
        assertThat(refreshed.getReviewCount()).isZero();
        assertThat(refreshed.getAvgRating()).isNull();

        mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(secondDeliveredOrder.getId(), product.getId(), 5, "Replacement", "Much better now.")))
            .andExpect(status().isCreated());
    }

    private String createReviewAndReturnId(String token, UUID orderId, UUID productId, int starRating, String title, String text) throws Exception {
        MvcResult reviewResult = mockMvc.perform(post("/api/reviews")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewBody(orderId, productId, starRating, title, text)))
            .andExpect(status().isCreated())
            .andReturn();
        return readJson(reviewResult).get("id").asText();
    }

    private String reviewBody(UUID orderId, UUID productId, int starRating, String title, String text) {
        return """
            {
              "orderId": "%s",
              "productId": "%s",
              "starRating": %d,
              "reviewTitle": "%s",
              "reviewText": "%s"
            }
            """.formatted(orderId, productId, starRating, title, text);
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

    private Order seedOrderWithItem(AppUser user, Store store, Product product, String status) {
        Order seededOrder = new Order();
        seededOrder.setId(UUID.randomUUID());
        seededOrder.setUser(user);
        seededOrder.setStore(store);
        seededOrder.setIncrementId("ORD-REVIEW-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        seededOrder.setOrderDate(LocalDateTime.now());
        seededOrder.setStatus(status);
        seededOrder.setPaymentStatus("PAID");
        seededOrder.setPaymentMethod("CREDIT_CARD");
        seededOrder.setSubtotal(new BigDecimal("99.90"));
        seededOrder.setDiscountAmount(BigDecimal.ZERO);
        seededOrder.setShippingFee(BigDecimal.ZERO);
        seededOrder.setTaxAmount(BigDecimal.ZERO);
        seededOrder.setGrandTotal(new BigDecimal("99.90"));
        seededOrder.setCurrency("TRY");
        seededOrder.setShippingAddressLine1("Review Address");
        seededOrder.setShippingCity("Istanbul");
        seededOrder.setShippingCountry("Turkey");
        seededOrder.setCustomerEmail(user.getEmail());
        Order savedOrder = orderRepository.save(seededOrder);

        OrderItem orderItem = new OrderItem();
        orderItem.setId(UUID.randomUUID());
        orderItem.setOrder(savedOrder);
        orderItem.setProduct(product);
        orderItem.setQuantity(1);
        orderItem.setUnitPriceAtPurchase(new BigDecimal("99.90"));
        orderItem.setDiscountApplied(BigDecimal.ZERO);
        orderItem.setSubtotal(new BigDecimal("99.90"));
        orderItem.setReturnStatus("NONE");
        orderItem.setReturnedQuantity(0);
        orderItemRepository.save(orderItem);
        return savedOrder;
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
