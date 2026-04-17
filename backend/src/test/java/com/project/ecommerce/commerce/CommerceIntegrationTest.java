package com.project.ecommerce.commerce;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import com.project.ecommerce.category.domain.Category;
import com.project.ecommerce.category.repository.CategoryRepository;
import com.project.ecommerce.coupon.domain.Coupon;
import com.project.ecommerce.coupon.repository.CouponRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.payment.domain.Payment;
import com.project.ecommerce.payment.domain.PaymentProvider;
import com.project.ecommerce.payment.domain.PaymentStatus;
import com.project.ecommerce.payment.repository.PaymentRepository;
import com.project.ecommerce.payment.service.StripePaymentService;
import com.project.ecommerce.store.domain.Store;
import com.project.ecommerce.store.repository.StoreRepository;
import com.stripe.model.Refund;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommerceIntegrationTest {

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

    @Autowired
    private CouponRepository couponRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @MockitoBean
    private StripePaymentService stripePaymentService;

    private AppUser corporateUser;
    private Store storeA;
    private Store storeB;
    private Store foreignStore;
    private Category category;
    private Product productA;
    private Product productB;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("""
            TRUNCATE TABLE
                notifications,
                audit_logs,
                shipments,
                order_items,
                orders,
                cart_store_coupons,
                cart_items,
                carts,
                coupons,
                review_responses,
                reviews,
                products,
                categories,
                stores,
                user_roles,
                users
            RESTART IDENTITY CASCADE
            """);

        category = seedCategory("Electronics", "electronics");
        seedUser("admin@test.local", RoleType.ADMIN, "Adm1nPass!");
        corporateUser = seedUser("corporate@test.local", RoleType.CORPORATE, "CorpPass1!");
        seedUser("individual@test.local", RoleType.INDIVIDUAL, "IndPass1!");
        AppUser foreignCorporate = seedUser("foreign.corporate@test.local", RoleType.CORPORATE, "CorpPass1!");

        storeA = seedStore(corporateUser, "Corporate Primary Store");
        storeB = seedStore(corporateUser, "Corporate Secondary Store");
        foreignStore = seedStore(foreignCorporate, "Foreign Store");

        productA = seedProduct(storeA, category, "SKU-A", "Alpha Headphones", new BigDecimal("100.00"), 10, true);
        productA.setCurrency("PKR");
        productRepository.save(productA);
        productB = seedProduct(storeB, category, "SKU-B", "Beta Keyboard", new BigDecimal("50.00"), 10, true);
        seedProduct(foreignStore, category, "SKU-C", "Foreign Monitor", new BigDecimal("80.00"), 5, true);

        seedCoupon(storeA, "WELCOME10", new BigDecimal("10.00"));
        seedCoupon(storeB, "YAZ20", new BigDecimal("20.00"));
    }

    @Test
    void productListShouldSupportPaginationAndFilters() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/products")
                .header("Authorization", bearer(token))
                .param("page", "0")
                .param("size", "1")
                .param("storeId", storeA.getId().toString())
                .param("categoryId", category.getId().toString())
                .param("q", "Alpha"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].title").value("Alpha Headphones"))
            .andExpect(jsonPath("$.items[0].storeId").value(storeA.getId().toString()))
            .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void corporateShouldCreateAndSoftDeleteOwnProduct() throws Exception {
        String token = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        String body = """
            {
              "storeId": "%s",
              "categoryId": "%s",
              "sku": "SKU-NEW",
              "title": "Created Product",
              "description": "Owned by corporate",
              "brand": "Codex",
              "unitPrice": 149.90,
              "stockQuantity": 7
            }
            """.formatted(storeA.getId(), category.getId());

        MvcResult createResult = mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Created Product"))
            .andReturn();

        String productId = readJson(createResult).get("id").asText();

        mockMvc.perform(delete("/api/products/{productId}", productId)
                .header("Authorization", bearer(token)))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/products/{productId}", productId)
                .header("Authorization", bearer(token)))
            .andExpect(status().isNotFound());

        assertThat(productRepository.findById(UUID.fromString(productId))).get().extracting(Product::isActive).isEqualTo(false);
    }

    @Test
    void corporateShouldUpdateAndPatchOwnProductAndAdjustStock() throws Exception {
        String token = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(put("/api/products/{productId}", productA.getId())
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "categoryId":"%s",
                      "title":"Alpha Headphones Pro",
                      "description":"Updated description",
                      "brand":"Codex Pro",
                      "imageUrls":["https://img.test/a.png"],
                      "unitPrice":125.50,
                      "discountPercentage":5.00,
                      "costOfProduct":70.00,
                      "stockQuantity":12,
                      "tags":["audio","pro"],
                      "active":true
                    }
                    """.formatted(category.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Alpha Headphones Pro"))
            .andExpect(jsonPath("$.unitPrice").value(125.50))
            .andExpect(jsonPath("$.stockQuantity").value(12));

        mockMvc.perform(patch("/api/products/{productId}", productA.getId())
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "brand":"Codex Elite",
                      "unitPrice":119.90
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.brand").value("Codex Elite"))
            .andExpect(jsonPath("$.unitPrice").value(119.90))
            .andExpect(jsonPath("$.stockQuantity").value(12));

        mockMvc.perform(patch("/api/products/{productId}/stock", productA.getId())
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stockQuantity":25}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stockQuantity").value(25));

        assertThat(productRepository.findById(productA.getId())).get()
            .extracting(Product::getStockQuantity, Product::getBrand)
            .containsExactly(25, "Codex Elite");
    }

    @Test
    void foreignCorporateShouldNotUpdateAnotherStoresProduct() throws Exception {
        String foreignCorporateToken = loginAndExtractAccessToken("foreign.corporate@test.local", "CorpPass1!");

        mockMvc.perform(patch("/api/products/{productId}", productA.getId())
                .header("Authorization", bearer(foreignCorporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"Hijacked"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot manage products for another store"));

        mockMvc.perform(patch("/api/products/{productId}/stock", productA.getId())
                .header("Authorization", bearer(foreignCorporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stockQuantity":99}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot manage products for another store"));
    }

    @Test
    void corporateShouldNotCreateProductForForeignStore() throws Exception {
        String token = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        String body = """
            {
              "storeId": "%s",
              "categoryId": "%s",
              "sku": "SKU-FAIL",
              "title": "Forbidden Product",
              "unitPrice": 99.90,
              "stockQuantity": 3
            }
            """.formatted(foreignStore.getId(), category.getId());

        mockMvc.perform(post("/api/products")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot manage products for another store"));
    }

    @Test
    void adminShouldCreateCouponAndCorporateShouldListAndUpdateOwnCoupons() throws Exception {
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        MvcResult createResult = mockMvc.perform(post("/api/coupons")
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "storeId":"%s",
                      "code":"BAYRAM20",
                      "discountPercentage":20.00,
                      "active":true
                    }
                    """.formatted(storeA.getId())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.storeId").value(storeA.getId().toString()))
            .andExpect(jsonPath("$.code").value("BAYRAM20"))
            .andReturn();

        String couponId = readJson(createResult).get("id").asText();
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(get("/api/coupons")
                .header("Authorization", bearer(corporateToken))
                .param("storeId", storeA.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(2));

        mockMvc.perform(patch("/api/coupons/{couponId}", couponId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "code":"BAYRAM25",
                      "discountPercentage":25.00,
                      "active":false
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("BAYRAM25"))
            .andExpect(jsonPath("$.discountPercentage").value(25.00))
            .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void invalidCouponStoreIdShouldReturnBadRequest() throws Exception {
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/coupons")
                .header("Authorization", bearer(adminToken))
                .param("storeId", "not-a-uuid"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Invalid value for parameter 'storeId'"));
    }

    @Test
    void corporateShouldNotManageForeignStoreCouponAndStoreCodesShouldBeUniquePerStore() throws Exception {
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(post("/api/coupons")
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "storeId":"%s",
                      "code":"WELCOME10",
                      "discountPercentage":10.00,
                      "active":true
                    }
                    """.formatted(foreignStore.getId())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot manage coupons for another store"));

        mockMvc.perform(post("/api/coupons")
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "storeId":"%s",
                      "code":"WELCOME10",
                      "discountPercentage":15.00,
                      "active":true
                    }
                    """.formatted(storeA.getId())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("Coupon code already exists for this store"));
    }

    @Test
    void individualShouldManageCartAndApplyStoreCoupon() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        MvcResult cartResult = mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":2}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalItemCount").value(2))
            .andExpect(jsonPath("$.stores[0].currency").value("PKR"))
            .andExpect(jsonPath("$.stores[0].items[0].currency").value("PKR"))
            .andReturn();

        String itemId = readJson(cartResult).get("stores").get(0).get("items").get(0).get("itemId").asText();

        mockMvc.perform(patch("/api/carts/me/items/{itemId}", itemId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"quantity":3}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItemCount").value(3))
            .andExpect(jsonPath("$.stores[0].subtotal").value(300.00));

        mockMvc.perform(post("/api/carts/me/stores/{storeId}/coupon", storeA.getId())
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"WELCOME10"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores[0].activeCoupon.code").value("WELCOME10"))
            .andExpect(jsonPath("$.stores[0].discountApplied").value(30.00))
            .andExpect(jsonPath("$.grandTotal").value(270.00));

        mockMvc.perform(patch("/api/carts/me/items/{itemId}", itemId)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"quantity":0}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItemCount").value(0))
            .andExpect(jsonPath("$.stores.length()").value(0))
            .andExpect(jsonPath("$.grandTotal").value(0.00));
    }

    @Test
    void cartShouldRejectStockOverflowAndCorporateAccess() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":99}
                    """.formatted(productA.getId())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Requested quantity exceeds available stock"));

        mockMvc.perform(get("/api/carts/me")
                .header("Authorization", bearer(corporateToken)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void corporateShouldListAndUpdateOnlyOwnedStores() throws Exception {
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        String foreignCorporateToken = loginAndExtractAccessToken("foreign.corporate@test.local", "CorpPass1!");

        mockMvc.perform(get("/api/corporate/stores")
                .header("Authorization", bearer(corporateToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(patch("/api/corporate/stores/{storeId}", storeA.getId())
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name":"Corporate Primary Store Updated",
                      "description":"Updated store description",
                      "contactEmail":"new-store@test.local",
                      "contactPhone":"+90 555 000 00 00",
                      "status":"CLOSED"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Corporate Primary Store Updated"))
            .andExpect(jsonPath("$.description").value("Updated store description"))
            .andExpect(jsonPath("$.contactEmail").value("new-store@test.local"))
            .andExpect(jsonPath("$.contactPhone").value("+90 555 000 00 00"))
            .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(patch("/api/corporate/stores/{storeId}", foreignStore.getId())
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Hijacked Store"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot manage another seller's store"));

        mockMvc.perform(patch("/api/corporate/stores/{storeId}", storeA.getId())
                .header("Authorization", bearer(foreignCorporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Hijacked Store"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("You cannot manage another seller's store"));
    }

    @Test
    void adminShouldSuspendStoreAndSellerCannotReopenIt() throws Exception {
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(patch("/api/admin/stores/{storeId}/status", storeA.getId())
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"SUSPENDED"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUSPENDED"));

        mockMvc.perform(patch("/api/corporate/stores/{storeId}", storeA.getId())
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"OPEN"}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("Suspended stores cannot be reopened by the seller"));

        Integer auditCount = jdbcTemplate.queryForObject(
            "select count(*) from audit_logs where action = 'STORE_STATUS_UPDATED' and details like ?",
            Integer.class,
            "%" + storeA.getId() + "%"
        );
        assertThat(auditCount).isEqualTo(1);
    }

    @Test
    void closedStoreShouldDisappearFromCatalogAndBlockCartAndCheckout() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/admin/stores/{storeId}/status", storeA.getId())
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"CLOSED"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(get("/api/products")
                .header("Authorization", bearer(individualToken))
                .param("storeId", storeA.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.totalElements").value(0));

        mockMvc.perform(get("/api/products/{productId}", productA.getId())
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productA.getId())))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("This store is closed, so you cannot buy from it"));

        mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Store Lock Mah. No:8",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Cart contains item from a closed store"));
    }

    @Test
    void multiStoreCheckoutShouldCreateOrdersShipmentsAndDecreaseStock() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":2}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productB.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/carts/me/stores/{storeId}/coupon", storeA.getId())
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"WELCOME10"}
                    """))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/carts/me/stores/{storeId}/coupon", storeB.getId())
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"YAZ20"}
                    """))
            .andExpect(status().isOk());

        MvcResult checkoutResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Test Mah. No:1",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey",
                      "customerPhone":"5550000000"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalOrdersCreated").value(2))
            .andExpect(jsonPath("$.grandTotal").value(220.00))
            .andExpect(jsonPath("$.createdOrders[0].currency").value("PKR"))
            .andExpect(jsonPath("$.createdOrders[1].currency").value("USD"))
            .andReturn();

        String firstOrderId = readJson(checkoutResult).get("createdOrders").get(0).get("orderId").asText();

        mockMvc.perform(get("/api/orders")
                .header("Authorization", bearer(token))
                .param("page", "0")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(2));

        mockMvc.perform(get("/api/orders/{orderId}", firstOrderId)
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.shipment.status").value("PENDING"));

        mockMvc.perform(get("/api/orders/{orderId}/shipment", firstOrderId)
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"));

        mockMvc.perform(get("/api/carts/me")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItemCount").value(0))
            .andExpect(jsonPath("$.grandTotal").value(0.00));

        assertThat(productRepository.findById(productA.getId())).get().extracting(Product::getStockQuantity).isEqualTo(8);
        assertThat(productRepository.findById(productB.getId())).get().extracting(Product::getStockQuantity).isEqualTo(9);
    }

    @Test
    void orderScopeShouldRejectForeignCorporateAccess() throws Exception {
        String token = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        MvcResult checkoutResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"WIRE_TRANSFER",
                      "shippingAddressLine1":"Test Mah. No:2",
                      "shippingCity":"Ankara",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();

        String orderId = readJson(checkoutResult).get("createdOrders").get(0).get("orderId").asText();
        String foreignCorporateToken = loginAndExtractAccessToken("foreign.corporate@test.local", "CorpPass1!");

        mockMvc.perform(get("/api/orders/{orderId}", orderId)
                .header("Authorization", bearer(foreignCorporateToken)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void corporateShouldUpdateOrderAndPaymentStatusAndRefundStockOnCancellation() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        MvcResult checkoutResult = mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":2}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated())
            .andReturn();

        mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Test Mah. No:3",
                      "shippingCity":"Izmir",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalOrdersCreated").value(1));

        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        UUID orderId = jdbcTemplate.queryForObject("select id from orders where store_id = ? limit 1", UUID.class, storeA.getId());

        mockMvc.perform(patch("/api/orders/{orderId}/payment-status", orderId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"paymentStatus":"PAID"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paymentStatus").value("PAID"));

        mockMvc.perform(patch("/api/orders/{orderId}/status", orderId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"CANCELLED"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertThat(productRepository.findById(productA.getId())).get().extracting(Product::getStockQuantity).isEqualTo(10);
        assertThat(jdbcTemplate.queryForObject("select status from shipments where order_id = ?", String.class, orderId)).isEqualTo("FAILED");

        mockMvc.perform(patch("/api/orders/{orderId}/status", orderId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"PROCESSING"}
                    """))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("Cancelled orders cannot be re-opened"));
    }

    @Test
    void adminStatusUpdateShouldBeVisibleToCustomerAndCancellationShouldRestoreStock() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":2}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        MvcResult checkoutResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Test Mah. No:4",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();

        String orderId = readJson(checkoutResult).get("createdOrders").get(0).get("orderId").asText();
        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(patch("/api/orders/{orderId}/status", orderId)
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"PROCESSING"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PROCESSING"));

        mockMvc.perform(get("/api/orders/{orderId}", orderId)
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PROCESSING"));

        mockMvc.perform(patch("/api/orders/{orderId}/status", orderId)
                .header("Authorization", bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"CANCELLED"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/orders/{orderId}", orderId)
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertThat(productRepository.findById(productA.getId())).get().extracting(Product::getStockQuantity).isEqualTo(10);
        assertThat(jdbcTemplate.queryForObject("select status from shipments where order_id = ?", String.class, UUID.fromString(orderId))).isEqualTo("FAILED");
    }

    @Test
    void corporateShouldUpdateOwnShipmentAndForeignCorporateShouldBeRejected() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        MvcResult checkoutResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"WIRE_TRANSFER",
                      "shippingAddressLine1":"Test Mah. No:4",
                      "shippingCity":"Bursa",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();

        String orderId = readJson(checkoutResult).get("createdOrders").get(0).get("orderId").asText();
        MvcResult shipmentResult = mockMvc.perform(get("/api/orders/{orderId}/shipment", orderId)
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andReturn();
        String shipmentId = readJson(shipmentResult).get("shipmentId").asText();

        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        mockMvc.perform(patch("/api/shipments/{shipmentId}", shipmentId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "status":"DELIVERED",
                      "trackingNumber":"TRK-1001",
                      "carrierName":"Aras",
                      "modeOfShipment":"GROUND"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DELIVERED"))
            .andExpect(jsonPath("$.trackingNumber").value("TRK-1001"))
            .andExpect(jsonPath("$.deliveredAt").exists());

        mockMvc.perform(get("/api/shipments/{shipmentId}", shipmentId)
                .header("Authorization", bearer(corporateToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.carrierName").value("Aras"));

        String foreignCorporateToken = loginAndExtractAccessToken("foreign.corporate@test.local", "CorpPass1!");
        mockMvc.perform(patch("/api/shipments/{shipmentId}", shipmentId)
                .header("Authorization", bearer(foreignCorporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"FAILED"}
                    """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void checkoutShouldCreateNotificationsAndUserShouldMarkOwnNotificationAsRead() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Test Mah. No:5",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated());

        MvcResult individualNotifications = mockMvc.perform(get("/api/notifications/me")
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].type").value("ORDER_CREATED"))
            .andReturn();

        String notificationId = readJson(individualNotifications).get("items").get(0).get("id").asText();

        mockMvc.perform(patch("/api/notifications/{notificationId}/read", notificationId)
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.read").value(true))
            .andExpect(jsonPath("$.readAt").exists());

        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        mockMvc.perform(get("/api/notifications/me")
                .header("Authorization", bearer(corporateToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].type").value("NEW_ORDER"));

        String foreignCorporateToken = loginAndExtractAccessToken("foreign.corporate@test.local", "CorpPass1!");
        mockMvc.perform(patch("/api/notifications/{notificationId}/read", notificationId)
                .header("Authorization", bearer(foreignCorporateToken)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void userShouldMarkAllOwnNotificationsAsRead() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Test Mah. No:6",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":1}
                    """.formatted(productB.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Test Mah. No:7",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/notifications/me")
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].read").value(false))
            .andExpect(jsonPath("$.items[1].read").value(false));

        mockMvc.perform(patch("/api/notifications/me/read-all")
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updatedCount").value(2));

        mockMvc.perform(get("/api/notifications/me")
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].read").value(true))
            .andExpect(jsonPath("$.items[0].readAt").exists())
            .andExpect(jsonPath("$.items[1].read").value(true))
            .andExpect(jsonPath("$.items[1].readAt").exists());

        mockMvc.perform(patch("/api/notifications/me/read-all")
                .header("Authorization", bearer(individualToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updatedCount").value(0));
    }

    @Test
    void individualShouldRequestReturnAndCorporateShouldApproveWithStockRefund() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":2}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/carts/me/stores/{storeId}/coupon", storeA.getId())
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"WELCOME10"}
                    """))
            .andExpect(status().isOk());

        MvcResult checkoutResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"CREDIT_CARD",
                      "shippingAddressLine1":"Return Mah. No:1",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();

        String orderId = readJson(checkoutResult).get("createdOrders").get(0).get("orderId").asText();
        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(patch("/api/orders/{orderId}/status", orderId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"DELIVERED"}
                    """))
            .andExpect(status().isOk());

        String orderItemId = jdbcTemplate.queryForObject(
            "select id from order_items where order_id = ? limit 1",
            String.class,
            UUID.fromString(orderId)
        );

        mockMvc.perform(post("/api/orders/items/{orderItemId}/return", orderItemId)
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "returnedQuantity":1,
                      "reason":"Defective unit"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.returnStatus").value("REQUESTED"))
            .andExpect(jsonPath("$.returnedQuantity").value(1))
            .andExpect(jsonPath("$.returnReason").value("Defective unit"))
            .andExpect(jsonPath("$.refundableAmount").value(90.00));

        mockMvc.perform(patch("/api/orders/items/{orderItemId}/return-status", orderItemId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "status":"RETURNED",
                      "note":"Approved after inspection"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.returnStatus").value("RETURNED"))
            .andExpect(jsonPath("$.returnUpdateNote").value("Approved after inspection"))
            .andExpect(jsonPath("$.refundableAmount").value(90.00));

        assertThat(productRepository.findById(productA.getId())).get().extracting(Product::getStockQuantity).isEqualTo(9);
    }

    @Test
    void approvedReturnShouldAllowCorporateStripeRefundForDiscountedNetAmount() throws Exception {
        String individualToken = loginAndExtractAccessToken("individual@test.local", "IndPass1!");

        mockMvc.perform(post("/api/carts/me/items")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"productId":"%s","quantity":2}
                    """.formatted(productA.getId())))
            .andExpect(status().isCreated());

        mockMvc.perform(post("/api/carts/me/stores/{storeId}/coupon", storeA.getId())
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"code":"WELCOME10"}
                    """))
            .andExpect(status().isOk());

        MvcResult checkoutResult = mockMvc.perform(post("/api/orders")
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "paymentMethod":"STRIPE_CARD",
                      "shippingAddressLine1":"Refund Mah. No:2",
                      "shippingCity":"Istanbul",
                      "shippingCountry":"Turkey"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();

        UUID orderId = UUID.fromString(readJson(checkoutResult).get("createdOrders").get(0).get("orderId").asText());
        BigDecimal orderGrandTotal = jdbcTemplate.queryForObject(
            "select grand_total from orders where id = ?",
            BigDecimal.class,
            orderId
        );
        assertThat(orderGrandTotal).isEqualByComparingTo("180.00");

        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setOrder(orderRepository.findById(orderId).orElseThrow());
        payment.setProvider(PaymentProvider.STRIPE);
        payment.setProviderPaymentIntentId("pi_test_refund");
        payment.setStatus(PaymentStatus.SUCCEEDED);
        payment.setAmount(new BigDecimal("180.00"));
        payment.setCurrency("PKR");
        paymentRepository.save(payment);
        jdbcTemplate.update("update orders set payment_status = 'PAID' where id = ?", orderId);

        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        mockMvc.perform(patch("/api/orders/{orderId}/status", orderId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"DELIVERED"}
                    """))
            .andExpect(status().isOk());

        String orderItemId = jdbcTemplate.queryForObject(
            "select id from order_items where order_id = ? limit 1",
            String.class,
            orderId
        );

        mockMvc.perform(post("/api/orders/items/{orderItemId}/return", orderItemId)
                .header("Authorization", bearer(individualToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "returnedQuantity":1,
                      "reason":"Wrong size"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.refundableAmount").value(90.00));

        mockMvc.perform(patch("/api/orders/items/{orderItemId}/return-status", orderItemId)
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"RETURNED"}
                    """))
            .andExpect(status().isOk());

        Refund stripeRefund = new Refund();
        stripeRefund.setId("re_test_refund");
        stripeRefund.setStatus("succeeded");
        when(stripePaymentService.createRefund(anyString(), any(BigDecimal.class), anyString(), any()))
            .thenReturn(stripeRefund);

        mockMvc.perform(post("/api/payments/stripe/refunds")
                .header("Authorization", bearer(corporateToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "orderItemId":"%s",
                      "reason":"Return approved"
                    }
                    """.formatted(orderItemId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.amount").value(90.00))
            .andExpect(jsonPath("$.status").value("SUCCEEDED"));

        assertThat(jdbcTemplate.queryForObject("select status from payments where order_id = ?", String.class, orderId))
            .isEqualTo("PARTIALLY_REFUNDED");
        assertThat(jdbcTemplate.queryForObject("select payment_status from orders where id = ?", String.class, orderId))
            .isEqualTo("PAID");
        assertThat(jdbcTemplate.queryForObject("select amount from payment_refunds where order_item_id = ?", BigDecimal.class, UUID.fromString(orderItemId)))
            .isEqualByComparingTo("90.00");
    }

    private Category seedCategory(String name, String slug) {
        Category entity = new Category();
        entity.setId(UUID.randomUUID());
        entity.setName(name);
        entity.setSlug(slug);
        entity.setDescription(name + " category");
        entity.setDisplayOrder(1);
        entity.setLevel(0);
        entity.setActive(true);
        return categoryRepository.save(entity);
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
        store.setSlug(name.toLowerCase().replaceAll("[^a-z0-9]+", "-") + "-" + store.getId().toString().substring(0, 8));
        store.setDescription(name + " description");
        store.setContactEmail(owner.getEmail());
        store.setStatus("OPEN");
        store.setProductCount(0);
        store.setTotalSales(new BigDecimal("0.00"));
        return storeRepository.save(store);
    }

    private Product seedProduct(Store store, Category productCategory, String sku, String title, BigDecimal unitPrice, int stock, boolean active) {
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setStore(store);
        product.setCategory(productCategory);
        product.setSku(sku);
        product.setTitle(title);
        product.setDescription(title + " description");
        product.setBrand("Codex");
        product.setUnitPrice(unitPrice);
        product.setStockQuantity(stock);
        product.setReviewCount(0);
        product.setTotalSales(0);
        product.setActive(active);
        return productRepository.save(product);
    }

    private Coupon seedCoupon(Store store, String code, BigDecimal discountPercentage) {
        Coupon coupon = new Coupon();
        coupon.setId(UUID.randomUUID());
        coupon.setStore(store);
        coupon.setCode(code);
        coupon.setDiscountPercentage(discountPercentage);
        coupon.setActive(true);
        coupon.setValidUntil(LocalDateTime.now().plusDays(30));
        return couponRepository.save(coupon);
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
