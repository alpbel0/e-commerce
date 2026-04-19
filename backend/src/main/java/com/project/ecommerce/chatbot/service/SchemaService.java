package com.project.ecommerce.chatbot.service;

import com.project.ecommerce.chatbot.dto.SchemaResponse;
import com.project.ecommerce.chatbot.dto.SchemaResponse.ColumnSchema;
import com.project.ecommerce.chatbot.dto.SchemaResponse.Relationship;
import com.project.ecommerce.chatbot.dto.SchemaResponse.RoleRules;
import com.project.ecommerce.chatbot.dto.SchemaResponse.TableSchema;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service providing analytics schema information to the AI service.
 * This schema is used by the SQL generation agent to produce valid queries.
 */
@Service
public class SchemaService {

    private static final String SCHEMA_VERSION = "1.0.0";

    /**
     * Returns the analytics schema for AI consumption.
     * This is a curated schema containing only analytics-relevant tables and columns.
     * Auth/security tables and sensitive columns are excluded.
     */
    public SchemaResponse getAnalyticsSchema() {
        List<TableSchema> tables = List.of(
            createStoresTable(),
            createProductsTable(),
            createCategoriesTable(),
            createOrdersTable(),
            createOrderItemsTable(),
            createShipmentsTable(),
            createReviewsTable(),
            createCustomerProfilesTable(),
            createCurrencyRatesTable(),
            createPaymentsTable(),
            createPaymentMethodsTable()
        );

        List<Relationship> relationships = List.of(
            new Relationship("products", "store_id", "stores", "id", "MANY_TO_ONE"),
            new Relationship("products", "category_id", "categories", "id", "MANY_TO_ONE"),
            new Relationship("orders", "store_id", "stores", "id", "MANY_TO_ONE"),
            new Relationship("orders", "user_id", "customer_profiles", "user_id", "MANY_TO_ONE"),
            new Relationship("order_items", "order_id", "orders", "id", "MANY_TO_ONE"),
            new Relationship("order_items", "product_id", "products", "id", "MANY_TO_ONE"),
            new Relationship("shipments", "order_id", "orders", "id", "ONE_TO_ONE"),
            new Relationship("reviews", "product_id", "products", "id", "MANY_TO_ONE"),
            new Relationship("reviews", "user_id", "customer_profiles", "user_id", "MANY_TO_ONE"),
            new Relationship("payments", "order_id", "orders", "id", "ONE_TO_ONE"),
            new Relationship("payments", "payment_method_id", "payment_methods", "id", "MANY_TO_ONE")
        );

        RoleRules roleRules = new RoleRules(
            // adminAccessibleTables
            List.of("stores", "products", "categories", "orders", "order_items", "shipments", "reviews", "customer_profiles", "currency_rates", "payments", "payment_methods"),
            // corporateAccessibleTables
            List.of("stores", "products", "categories", "orders", "order_items", "shipments", "reviews", "customer_profiles", "currency_rates", "payments", "payment_methods"),
            // individualAccessibleTables
            List.of("orders", "order_items", "shipments", "reviews", "customer_profiles", "products", "categories"),
            // sensitiveColumns
            List.of("password", "password_hash", "email", "contact_email", "phone", "contact_phone", "address", "token", "refresh_token", "secret", "reset_token", "owner_id", "customer_email", "customer_phone", "shipping_address_line1", "shipping_address_line2", "shipping_city", "shipping_state", "shipping_postal_code", "shipping_country"),
            // piiColumns
            List.of("email", "contact_email", "phone", "contact_phone", "address", "customer_email", "customer_phone", "shipping_address_line1", "shipping_address_line2", "shipping_city", "shipping_state", "shipping_postal_code", "shipping_country")
        );

        return SchemaResponse.create(SCHEMA_VERSION, tables, relationships, roleRules);
    }

    private TableSchema createStoresTable() {
        return new TableSchema(
            "stores",
            "Store information. Corporate users can only query their own stores.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("name", "VARCHAR(255)", "Store name", false, false),
                new ColumnSchema("description", "TEXT", "Store description", false, false),
                new ColumnSchema("logo_url", "VARCHAR(500)", "Store logo URL", false, false),
                new ColumnSchema("total_sales", "DECIMAL(12,2)", "Total revenue", false, false),
                new ColumnSchema("product_count", "INTEGER", "Number of products", false, false),
                new ColumnSchema("rating", "DECIMAL(3,2)", "Stored store rating snapshot; for analytics compute ratings from reviews via products", false, false),
                new ColumnSchema("status", "VARCHAR(50)", "PENDING/OPEN/CLOSED/SUSPENDED", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
                // Excluded: owner_id (internal), contact_email (PII), contact_phone (PII), address (PII)
            ),
            true
        );
    }

    private TableSchema createProductsTable() {
        return new TableSchema(
            "products",
            "Product catalog. Each product belongs to a store.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("store_id", "UUID", "FK to stores.id", false, false),
                new ColumnSchema("category_id", "UUID", "FK to categories.id", false, false),
                new ColumnSchema("sku", "VARCHAR(100)", "Stock keeping unit", false, false),
                new ColumnSchema("title", "VARCHAR(255)", "Product title", false, false),
                new ColumnSchema("description", "TEXT", "Product description", false, false),
                new ColumnSchema("brand", "VARCHAR(100)", "Brand name", false, false),
                new ColumnSchema("currency", "VARCHAR(3)", "Product currency code (USD/TRY/EUR)", false, false),
                new ColumnSchema("unit_price", "DECIMAL(10,2)", "Unit price in the product currency", false, false),
                new ColumnSchema("discount_percentage", "DECIMAL(5,2)", "Discount percentage (0-100)", false, false),
                new ColumnSchema("stock_quantity", "INTEGER", "Available stock", false, false),
                new ColumnSchema("avg_rating", "DECIMAL(3,2)", "Stored product rating snapshot; for analytics ranking compute AVG(reviews.star_rating)", false, false),
                new ColumnSchema("review_count", "INTEGER", "Stored review count snapshot; for analytics ranking compute COUNT(reviews.id)", false, false),
                new ColumnSchema("total_sales", "INTEGER", "Total units sold", false, false),
                new ColumnSchema("is_active", "BOOLEAN", "Whether product is active", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createCategoriesTable() {
        return new TableSchema(
            "categories",
            "Category hierarchy. Supports parent-child relationships.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("name", "VARCHAR(255)", "Category name", false, false),
                new ColumnSchema("slug", "VARCHAR(255)", "URL-friendly name", false, false),
                new ColumnSchema("description", "TEXT", "Category description", false, false),
                new ColumnSchema("icon_url", "VARCHAR(500)", "Icon URL", false, false),
                new ColumnSchema("display_order", "INTEGER", "Display order", false, false),
                new ColumnSchema("parent_id", "UUID", "FK to parent category.id", false, false),
                new ColumnSchema("level", "INTEGER", "Hierarchy level (0=root)", false, false),
                new ColumnSchema("is_active", "BOOLEAN", "Whether category is active", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createOrdersTable() {
        return new TableSchema(
            "orders",
            "Orders. Each order belongs to a user and a store.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("user_id", "UUID", "FK to users.id", false, false),
                new ColumnSchema("store_id", "UUID", "FK to stores.id", false, false),
                new ColumnSchema("increment_id", "VARCHAR(100)", "Human-readable order number", false, false),
                new ColumnSchema("order_date", "TIMESTAMP", "Order date", false, false),
                new ColumnSchema("status", "VARCHAR(50)", "PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED/RETURNED", false, false),
                new ColumnSchema("payment_status", "VARCHAR(50)", "PENDING/PAID/FAILED/REFUNDED", false, false),
                new ColumnSchema("payment_method", "VARCHAR(100)", "Payment method code", false, false),
                new ColumnSchema("subtotal", "DECIMAL(12,2)", "Items subtotal", false, false),
                new ColumnSchema("discount_amount", "DECIMAL(12,2)", "Discount applied", false, false),
                new ColumnSchema("shipping_fee", "DECIMAL(10,2)", "Shipping fee", false, false),
                new ColumnSchema("tax_amount", "DECIMAL(10,2)", "Tax amount", false, false),
                new ColumnSchema("grand_total", "DECIMAL(12,2)", "Final total amount", false, false),
                new ColumnSchema("currency", "VARCHAR(3)", "Currency code (USD/TRY/EUR)", false, false),
                new ColumnSchema("coupon_code", "VARCHAR(50)", "Applied coupon code", false, false),
                new ColumnSchema("notes", "TEXT", "Order notes", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
                // Excluded: customer_email (PII), customer_phone (PII), shipping_address_* (PII)
            ),
            true
        );
    }

    private TableSchema createOrderItemsTable() {
        return new TableSchema(
            "order_items",
            "Order line items. Each item belongs to an order and a product.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("order_id", "UUID", "FK to orders.id", false, false),
                new ColumnSchema("product_id", "UUID", "FK to products.id", false, false),
                new ColumnSchema("quantity", "INTEGER", "Quantity ordered", false, false),
                new ColumnSchema("unit_price_at_purchase", "DECIMAL(10,2)", "Price at purchase time", false, false),
                new ColumnSchema("discount_applied", "DECIMAL(5,2)", "Discount applied", false, false),
                new ColumnSchema("subtotal", "DECIMAL(10,2)", "Line item total", false, false),
                new ColumnSchema("return_status", "VARCHAR(50)", "NONE/REQUESTED/APPROVED/REJECTED/COMPLETED", false, false),
                new ColumnSchema("return_reason", "TEXT", "Reason for return", false, false),
                new ColumnSchema("returned_quantity", "INTEGER", "Quantity returned", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createShipmentsTable() {
        return new TableSchema(
            "shipments",
            "Shipment/delivery information. One per order.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("order_id", "UUID", "FK to orders.id (UNIQUE)", false, false),
                new ColumnSchema("tracking_number", "VARCHAR(100)", "Carrier tracking number", false, false),
                new ColumnSchema("mode_of_shipment", "VARCHAR(50)", "Shipping mode", false, false),
                new ColumnSchema("carrier_name", "VARCHAR(100)", "Carrier name (FedEx, UPS, etc.)", false, false),
                new ColumnSchema("estimated_delivery_date", "DATE", "Estimated delivery date", false, false),
                new ColumnSchema("actual_delivery_date", "DATE", "Actual delivery date", false, false),
                new ColumnSchema("status", "VARCHAR(50)", "PENDING/PICKED/IN_TRANSIT/OUT_FOR_DELIVERY/DELIVERED/FAILED/RETURNED", false, false),
                new ColumnSchema("shipped_at", "TIMESTAMP", "Shipped timestamp", false, false),
                new ColumnSchema("delivered_at", "TIMESTAMP", "Delivered timestamp", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createReviewsTable() {
        return new TableSchema(
            "reviews",
            "Product reviews. Users rate products 1-5 stars.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("user_id", "UUID", "FK to users.id", false, false),
                new ColumnSchema("product_id", "UUID", "FK to products.id", false, false),
                new ColumnSchema("order_id", "UUID", "FK to orders.id (optional)", false, false),
                new ColumnSchema("star_rating", "INTEGER", "Rating 1-5", false, false),
                new ColumnSchema("review_title", "VARCHAR(255)", "Review headline", false, false),
                new ColumnSchema("review_text", "TEXT", "Full review text", false, false),
                new ColumnSchema("verified_purchase", "BOOLEAN", "Verified purchase flag", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createCustomerProfilesTable() {
        return new TableSchema(
            "customer_profiles",
            "Customer demographic and behavioral data. For aggregate analysis only - no PII.",
            List.of(
                new ColumnSchema("user_id", "UUID", "FK to users.id (PRIMARY KEY)", false, false),
                new ColumnSchema("gender", "VARCHAR(20)", "MALE/FEMALE/OTHER", false, false),
                new ColumnSchema("age", "INTEGER", "Customer age", false, false),
                new ColumnSchema("city", "VARCHAR(100)", "City name", false, false),
                new ColumnSchema("membership_type", "VARCHAR(50)", "Observed values in current dataset: Bronze/Silver/Gold", false, false),
                new ColumnSchema("total_spend", "DECIMAL(12,2)", "Lifetime spend", false, false),
                new ColumnSchema("prior_purchases", "INTEGER", "Previous order count", false, false),
                new ColumnSchema("satisfaction_level", "INTEGER", "Satisfaction score 1-10", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createCurrencyRatesTable() {
        return new TableSchema(
            "currency_rates",
            "Exchange rates. Base currency is USD.",
            List.of(
                new ColumnSchema("id", "SERIAL", "Primary key (integer)", false, false),
                new ColumnSchema("base_currency", "VARCHAR(3)", "Base currency code (USD)", false, false),
                new ColumnSchema("target_currency", "VARCHAR(3)", "Target currency code", false, false),
                new ColumnSchema("rate", "DECIMAL(18,6)", "Exchange rate (1 base = X target)", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }

    private TableSchema createPaymentsTable() {
        return new TableSchema(
            "payments",
            "Payment records. One per order.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("order_id", "UUID", "FK to orders.id (UNIQUE)", false, false),
                new ColumnSchema("payment_method_id", "UUID", "FK to payment_methods.id", false, false),
                new ColumnSchema("provider", "VARCHAR(50)", "Payment provider (STRIPE)", false, false),
                new ColumnSchema("status", "VARCHAR(50)", "PENDING/REQUIRES_ACTION/SUCCEEDED/FAILED/REFUNDED/PARTIALLY_REFUNDED", false, false),
                new ColumnSchema("amount", "DECIMAL(12,2)", "Payment amount", false, false),
                new ColumnSchema("currency", "VARCHAR(3)", "Currency code", false, false),
                new ColumnSchema("failure_message", "TEXT", "Failure message if failed", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
                // Excluded: provider_payment_intent_id (security), provider_charge_id (security)
            ),
            true
        );
    }

    private TableSchema createPaymentMethodsTable() {
        return new TableSchema(
            "payment_methods",
            "Available payment methods.",
            List.of(
                new ColumnSchema("id", "UUID", "Primary key", false, false),
                new ColumnSchema("code", "VARCHAR(50)", "Method code (STRIPE_CARD, CREDIT_CARD, etc.)", false, false),
                new ColumnSchema("name", "VARCHAR(100)", "Display name", false, false),
                new ColumnSchema("is_active", "BOOLEAN", "Whether method is active", false, false),
                new ColumnSchema("created_at", "TIMESTAMP", "Creation timestamp", false, false),
                new ColumnSchema("updated_at", "TIMESTAMP", "Last update timestamp", false, false)
            ),
            true
        );
    }
}
