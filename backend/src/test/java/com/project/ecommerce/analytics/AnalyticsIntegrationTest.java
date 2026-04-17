package com.project.ecommerce.analytics;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.project.ecommerce.category.domain.Category;
import com.project.ecommerce.category.repository.CategoryRepository;
import com.project.ecommerce.order.domain.Order;
import com.project.ecommerce.order.domain.OrderItem;
import com.project.ecommerce.order.repository.OrderItemRepository;
import com.project.ecommerce.order.repository.OrderRepository;
import com.project.ecommerce.product.domain.Product;
import com.project.ecommerce.product.repository.ProductRepository;
import com.project.ecommerce.shipment.domain.Shipment;
import com.project.ecommerce.shipment.repository.ShipmentRepository;
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
class AnalyticsIntegrationTest {

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
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    private AppUser corporateUser;
    private AppUser individualUser;
    private Store corporateStoreA;
    private Store corporateStoreB;
    private Store foreignStore;
    private Product deletedProduct;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("""
            TRUNCATE TABLE
                shipments,
                order_items,
                orders,
                cart_store_coupons,
                cart_items,
                carts,
                coupons,
                reviews,
                products,
                categories,
                stores,
                user_roles,
                users
            RESTART IDENTITY CASCADE
            """);

        Category category = seedCategory("Analytics", "analytics");
        seedUser("admin@test.local", RoleType.ADMIN, "Adm1nPass!");
        corporateUser = seedUser("corporate@test.local", RoleType.CORPORATE, "CorpPass1!");
        individualUser = seedUser("individual@test.local", RoleType.INDIVIDUAL, "IndPass1!");
        AppUser foreignCorporate = seedUser("foreign.corporate@test.local", RoleType.CORPORATE, "CorpPass1!");

        corporateStoreA = seedStore(corporateUser, "Corporate Analytics Store A");
        corporateStoreB = seedStore(corporateUser, "Corporate Analytics Store B");
        foreignStore = seedStore(foreignCorporate, "Foreign Analytics Store");
        seedStore(foreignCorporate, "No Order Store");

        deletedProduct = seedProduct(corporateStoreA, category, "AN-DEL", "Deleted Revenue Product", new BigDecimal("120.00"), 10, false);
        Product activeProduct = seedProduct(corporateStoreB, category, "AN-ACT", "Active Revenue Product", new BigDecimal("80.00"), 10, true);
        Product foreignProduct = seedProduct(foreignStore, category, "AN-FOR", "Foreign Revenue Product", new BigDecimal("60.00"), 10, true);

        seedOrderWithItem(individualUser, corporateStoreA, deletedProduct, 2, new BigDecimal("216.00"), "WELCOME10");
        seedOrderWithItem(individualUser, corporateStoreB, activeProduct, 1, new BigDecimal("80.00"), null);
        seedOrderWithItem(individualUser, foreignStore, foreignProduct, 1, new BigDecimal("60.00"), null);
    }

    @Test
    void adminAnalyticsShouldReturnSummaryAndTopLists() throws Exception {
        String token = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");

        mockMvc.perform(get("/api/analytics/admin/summary")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalOrders").value(3))
            .andExpect(jsonPath("$.totalStores").value(4))
            .andExpect(jsonPath("$.totalRevenue").value(356.00));

        mockMvc.perform(get("/api/analytics/admin/top-products")
                .header("Authorization", bearer(token))
                .param("limit", "3"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].productTitle").value("Deleted Revenue Product"));

        mockMvc.perform(get("/api/analytics/admin/top-stores")
                .header("Authorization", bearer(token))
                .param("limit", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(4))
            .andExpect(jsonPath("$.items[0].storeName").value("Corporate Analytics Store A"));
    }

    @Test
    void corporateAnalyticsShouldSupportStoreFilter() throws Exception {
        String token = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(get("/api/analytics/corporate/summary")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalRevenue").value(296.00))
            .andExpect(jsonPath("$.totalOrders").value(2));

        mockMvc.perform(get("/api/analytics/corporate/summary")
                .header("Authorization", bearer(token))
                .param("storeId", corporateStoreA.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalRevenue").value(216.00))
            .andExpect(jsonPath("$.totalOrders").value(1));

        mockMvc.perform(get("/api/analytics/corporate/revenue-by-store")
                .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void corporateAnalyticsShouldRejectForeignStoreFilter() throws Exception {
        String token = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");

        mockMvc.perform(get("/api/analytics/corporate/summary")
                .header("Authorization", bearer(token))
                .param("storeId", foreignStore.getId().toString()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value("Requested store is outside your scope"));
    }

    @Test
    void deletedProductShouldStillAppearInAnalytics() throws Exception {
        assertThat(productRepository.findById(deletedProduct.getId())).get().extracting(Product::isActive).isEqualTo(false);

        String adminToken = loginAndExtractAccessToken("admin@test.local", "Adm1nPass!");
        mockMvc.perform(get("/api/analytics/admin/top-products")
                .header("Authorization", bearer(adminToken))
                .param("limit", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].productTitle").value("Deleted Revenue Product"));

        String corporateToken = loginAndExtractAccessToken("corporate@test.local", "CorpPass1!");
        mockMvc.perform(get("/api/analytics/corporate/top-products")
                .header("Authorization", bearer(corporateToken))
                .param("storeId", corporateStoreA.getId().toString())
                .param("limit", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].productTitle").value("Deleted Revenue Product"));
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
        store.setContactEmail(owner.getEmail());
        store.setStatus("OPEN");
        store.setProductCount(0);
        store.setTotalSales(new BigDecimal("0.00"));
        return storeRepository.save(store);
    }

    private Product seedProduct(Store store, Category category, String sku, String title, BigDecimal unitPrice, int stock, boolean active) {
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setStore(store);
        product.setCategory(category);
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

    private void seedOrderWithItem(AppUser customer, Store store, Product product, int quantity, BigDecimal grandTotal, String couponCode) {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setUser(customer);
        order.setStore(store);
        order.setIncrementId("ORD-TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setOrderDate(LocalDateTime.now());
        order.setStatus("PENDING");
        order.setPaymentStatus("PENDING");
        order.setPaymentMethod("CREDIT_CARD");
        order.setSubtotal(grandTotal);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setShippingFee(BigDecimal.ZERO);
        order.setTaxAmount(BigDecimal.ZERO);
        order.setGrandTotal(grandTotal);
        order.setCurrency("TRY");
        order.setCouponCode(couponCode);
        order.setShippingAddressLine1("Analytics Address");
        order.setShippingCity("Istanbul");
        order.setShippingCountry("Turkey");
        order.setCustomerEmail(customer.getEmail());
        orderRepository.save(order);

        OrderItem orderItem = new OrderItem();
        orderItem.setId(UUID.randomUUID());
        orderItem.setOrder(order);
        orderItem.setProduct(product);
        orderItem.setQuantity(quantity);
        orderItem.setUnitPriceAtPurchase(product.getUnitPrice());
        orderItem.setDiscountApplied(BigDecimal.ZERO);
        orderItem.setSubtotal(grandTotal);
        orderItem.setReturnStatus("NONE");
        orderItem.setReturnedQuantity(0);
        orderItemRepository.save(orderItem);

        Shipment shipment = new Shipment();
        shipment.setId(UUID.randomUUID());
        shipment.setOrder(order);
        shipment.setStatus("PENDING");
        shipmentRepository.save(shipment);
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
