CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_category_level()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.level = 0;
    ELSE
        SELECT level + 1 INTO NEW.level
        FROM categories
        WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_order_item_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    NEW.subtotal = (NEW.unit_price_at_purchase * NEW.quantity) - NEW.discount_applied;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('ADMIN', 'CORPORATE', 'INDIVIDUAL')),
    is_active_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_type)
);

CREATE TABLE customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gender VARCHAR(20),
    age INT,
    city VARCHAR(100),
    membership_type VARCHAR(50),
    total_spend DECIMAL(12, 2) DEFAULT 0.00,
    prior_purchases INT DEFAULT 0,
    satisfaction_level INT CHECK (satisfaction_level BETWEEN 1 AND 10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    total_sales DECIMAL(12, 2) DEFAULT 0.00,
    product_count INT DEFAULT 0,
    rating DECIMAL(3, 2) CHECK (rating BETWEEN 1.00 AND 5.00),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPEN', 'CLOSED', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    display_order INT DEFAULT 0,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_no_self_reference CHECK (id != parent_id)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    brand VARCHAR(100),
    image_urls TEXT[],
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percentage DECIMAL(5, 2) CHECK (discount_percentage BETWEEN 0 AND 100),
    cost_of_product DECIMAL(10, 2) CHECK (cost_of_product >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    tags TEXT[],
    avg_rating DECIMAL(3, 2) CHECK (avg_rating BETWEEN 1.00 AND 5.00),
    review_count INT DEFAULT 0,
    total_sales INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    increment_id VARCHAR(100) UNIQUE,
    order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED')),
    payment_status VARCHAR(50) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    payment_method VARCHAR(100),
    subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount DECIMAL(12, 2) DEFAULT 0.00 CHECK (discount_amount >= 0),
    shipping_fee DECIMAL(10, 2) DEFAULT 0.00 CHECK (shipping_fee >= 0),
    tax_amount DECIMAL(10, 2) DEFAULT 0.00 CHECK (tax_amount >= 0),
    grand_total DECIMAL(12, 2) NOT NULL CHECK (grand_total >= 0),
    currency VARCHAR(3) DEFAULT 'TRY',
    coupon_code VARCHAR(50),
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100) DEFAULT 'Turkey',
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_at_purchase DECIMAL(10, 2) NOT NULL CHECK (unit_price_at_purchase >= 0),
    discount_applied DECIMAL(5, 2) DEFAULT 0.00 CHECK (discount_applied >= 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    return_status VARCHAR(50) DEFAULT 'NONE' CHECK (return_status IN ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED')),
    return_reason TEXT,
    returned_quantity INT DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tracking_number VARCHAR(100) UNIQUE,
    mode_of_shipment VARCHAR(50),
    carrier_name VARCHAR(100),
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PICKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED')),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    star_rating INT NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
    review_title VARCHAR(255),
    review_text TEXT,
    review_images TEXT[],
    verified_purchase BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    responder_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE source_customer_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system VARCHAR(50) NOT NULL,
    source_customer_id VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_system, source_customer_id)
);

CREATE TABLE source_product_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system VARCHAR(50) NOT NULL,
    source_product_id VARCHAR(255) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_system, source_product_id)
);

CREATE TABLE source_order_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_system VARCHAR(50) NOT NULL,
    source_order_id VARCHAR(100) NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_system, source_order_id)
);

CREATE TABLE chat_context_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    active_role VARCHAR(50) NOT NULL CHECK (active_role IN ('ADMIN', 'CORPORATE', 'INDIVIDUAL')),
    user_query TEXT NOT NULL,
    ai_response TEXT,
    generated_sql TEXT,
    conversation_turn INT NOT NULL DEFAULT 1 CHECK (conversation_turn > 0),
    has_error BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_eval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chat_context_memory(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL CHECK (agent_name IN ('GUARDRAILS_AGENT', 'SQL_AGENT', 'ANALYSIS_AGENT', 'VISUALIZATION_AGENT', 'ERROR_AGENT')),
    model_name VARCHAR(100),
    generated_sql TEXT,
    execution_success BOOLEAN NOT NULL,
    latency_ms INT CHECK (latency_ms >= 0),
    input_tokens INT CHECK (input_tokens >= 0),
    output_tokens INT CHECK (output_tokens >= 0),
    user_feedback_score INT CHECK (user_feedback_score BETWEEN 1 AND 5),
    error_message TEXT,
    agent_input JSONB,
    agent_output JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, product_id)
);

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percentage DECIMAL(5, 2) CHECK (discount_percentage BETWEEN 0 AND 100),
    valid_until TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_updated_at_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_customer_profiles
BEFORE UPDATE ON customer_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_stores
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_categories
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_category_level
BEFORE INSERT OR UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION calculate_category_level();

CREATE TRIGGER set_updated_at_products
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_orders
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_order_items
BEFORE UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_order_item_subtotal
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION calculate_order_item_subtotal();

CREATE TRIGGER set_updated_at_shipments
BEFORE UPDATE ON shipments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_reviews
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_review_responses
BEFORE UPDATE ON review_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_carts
BEFORE UPDATE ON carts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_active ON user_roles(user_id, is_active_role) WHERE is_active_role = TRUE;
CREATE INDEX idx_customer_profiles_user_id ON customer_profiles(user_id);
CREATE INDEX idx_customer_profiles_membership ON customer_profiles(membership_type);
CREATE INDEX idx_customer_profiles_spending ON customer_profiles(total_spend DESC);
CREATE INDEX idx_stores_owner_id ON stores(owner_id);
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_level ON categories(level);
CREATE INDEX idx_categories_active ON categories(is_active);
CREATE INDEX idx_categories_display_order ON categories(display_order);
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_return_status ON order_items(return_status);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_star_rating ON reviews(star_rating);
CREATE INDEX idx_review_responses_review_id ON review_responses(review_id);
CREATE INDEX idx_review_responses_responder_user_id ON review_responses(responder_user_id);
CREATE INDEX idx_source_customer_map_user_id ON source_customer_map(user_id);
CREATE INDEX idx_source_customer_map_source ON source_customer_map(source_system, source_customer_id);
CREATE INDEX idx_source_product_map_product_id ON source_product_map(product_id);
CREATE INDEX idx_source_product_map_source ON source_product_map(source_system, source_product_id);
CREATE INDEX idx_source_order_map_order_id ON source_order_map(order_id);
CREATE INDEX idx_source_order_map_source ON source_order_map(source_system, source_order_id);
CREATE INDEX idx_chat_context_user_id ON chat_context_memory(user_id);
CREATE INDEX idx_chat_context_session_id ON chat_context_memory(session_id);
CREATE INDEX idx_chat_context_active_role ON chat_context_memory(active_role);
CREATE INDEX idx_chat_context_created_at ON chat_context_memory(created_at DESC);
CREATE INDEX idx_eval_logs_chat_id ON ai_eval_logs(chat_id);
CREATE INDEX idx_eval_logs_agent ON ai_eval_logs(agent_name);
CREATE INDEX idx_eval_logs_success ON ai_eval_logs(execution_success);
CREATE INDEX idx_eval_logs_created_at ON ai_eval_logs(created_at DESC);
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active);
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
