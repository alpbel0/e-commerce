from dataclasses import dataclass
from pathlib import Path
from uuid import UUID


BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "raw"
STAGING_DIR = BASE_DIR / "staging"
MAPPINGS_DIR = BASE_DIR / "mappings"
LOG_DIR = BASE_DIR / "logs"
SAMPLES_DIR = BASE_DIR / "samples"
UUID_NAMESPACE = UUID("f57b8ce8-74d2-4be8-a744-3eb64d9bbec3")
SHIPMENT_ASSIGNMENT_SEED = 20260410
AMAZON_REVIEWS_SAMPLE_LIMIT = 200_000
PAKISTAN_DEV_SAMPLE_LIMIT = 50_000


STATUS_MAP = {
    "pending": "PENDING",
    "confirmed": "CONFIRMED",
    "processing": "PROCESSING",
    "shipped": "SHIPPED",
    "delivered": "DELIVERED",
    "complete": "DELIVERED",
    "completed": "DELIVERED",
    "cancelled": "CANCELLED",
    "canceled": "CANCELLED",
    "returned": "RETURNED",
}

PAYMENT_METHOD_MAP = {
    "cod": "COD",
    "cash on delivery": "COD",
    "credit card": "CREDIT_CARD",
    "credit_card": "CREDIT_CARD",
    "debit card": "DEBIT_CARD",
    "paypal": "PAYPAL",
}

BOOLEAN_MAP = {
    "true": True,
    "false": False,
    "y": True,
    "n": False,
    "yes": True,
    "no": False,
    "1": True,
    "0": False,
}

SATISFACTION_LEVEL_MAP = {
    "unsatisfied": 2,
    "neutral": 5,
    "satisfied": 8,
}


@dataclass(frozen=True)
class DatasetConfig:
    source_system: str
    input_filename: str
    output_filename: str
    reject_filename: str
    reader: str
    rename_map: dict[str, str]
    date_columns: tuple[str, ...]
    numeric_columns: tuple[str, ...]
    integer_columns: tuple[str, ...]
    identifier_columns: tuple[str, ...]


PHASE_1_DATASETS: tuple[DatasetConfig, ...] = (
    DatasetConfig(
        source_system="AMAZON",
        input_filename="Amazon.csv",
        output_filename="amazon_staging.csv",
        reject_filename="amazon_rejects.csv",
        reader="csv",
        rename_map={
            "OrderID": "order_id",
            "OrderDate": "order_date",
            "CustomerID": "customer_id",
            "CustomerName": "customer_name",
            "ProductID": "product_id",
            "ProductName": "product_name",
            "Category": "category_name",
            "Brand": "brand",
            "Quantity": "quantity",
            "UnitPrice": "unit_price",
            "Discount": "discount_amount",
            "Tax": "tax_amount",
            "ShippingCost": "shipping_cost",
            "TotalAmount": "total_amount",
            "PaymentMethod": "payment_method",
            "OrderStatus": "order_status",
            "City": "city",
            "State": "state",
            "Country": "country",
            "SellerID": "seller_id",
        },
        date_columns=("order_date",),
        numeric_columns=("quantity", "unit_price", "discount_amount", "tax_amount", "shipping_cost", "total_amount"),
        integer_columns=("quantity",),
        identifier_columns=("order_id", "customer_id", "product_id", "seller_id"),
    ),
    DatasetConfig(
        source_system="CUSTOMER_BEHAVIOR",
        input_filename="E-commerce Customer Behavior - Sheet1.csv",
        output_filename="customer_behavior_staging.csv",
        reject_filename="customer_behavior_rejects.csv",
        reader="csv",
        rename_map={
            "Customer ID": "customer_id",
            "Gender": "gender",
            "Age": "age",
            "City": "city",
            "Membership Type": "membership_type",
            "Total Spend": "total_spend",
            "Items Purchased": "items_purchased",
            "Average Rating": "average_rating",
            "Discount Applied": "discount_applied",
            "Days Since Last Purchase": "days_since_last_purchase",
            "Satisfaction Level": "satisfaction_level_raw",
        },
        date_columns=(),
        numeric_columns=("age", "total_spend", "items_purchased", "average_rating", "days_since_last_purchase"),
        integer_columns=("age", "items_purchased", "days_since_last_purchase"),
        identifier_columns=("customer_id",),
    ),
    DatasetConfig(
        source_system="ONLINE_RETAIL",
        input_filename="Online Retail.xlsx",
        output_filename="online_retail_staging.csv",
        reject_filename="online_retail_rejects.csv",
        reader="excel",
        rename_map={
            "InvoiceNo": "invoice_no",
            "StockCode": "stock_code",
            "Description": "description",
            "Quantity": "quantity",
            "InvoiceDate": "invoice_date",
            "UnitPrice": "unit_price",
            "CustomerID": "customer_id",
            "Country": "country",
        },
        date_columns=("invoice_date",),
        numeric_columns=("quantity", "unit_price"),
        integer_columns=("quantity",),
        identifier_columns=("invoice_no", "stock_code", "customer_id"),
    ),
    DatasetConfig(
        source_system="PAKISTAN",
        input_filename="Pakistan Largest Ecommerce Dataset.csv",
        output_filename="pakistan_staging.csv",
        reject_filename="pakistan_rejects.csv",
        reader="csv",
        rename_map={
            "item_id": "line_item_id",
            "status": "order_status",
            "created_at": "order_date",
            "sku": "product_id",
            "price": "unit_price",
            "qty_ordered": "quantity",
            "grand_total": "grand_total",
            "increment_id": "order_id",
            "category_name_1": "category_name",
            "sales_commission_code": "sales_commission_code",
            "discount_amount": "discount_amount",
            "payment_method": "payment_method",
            "Customer ID": "customer_id",
        },
        date_columns=("order_date",),
        numeric_columns=("unit_price", "quantity", "grand_total", "discount_amount"),
        integer_columns=("quantity",),
        identifier_columns=("line_item_id", "order_id", "product_id", "customer_id"),
    ),
)

TRAIN_DATASET = DatasetConfig(
    source_system="TRAIN",
    input_filename="Train.csv",
    output_filename="train_shipments_staging.csv",
    reject_filename="train_rejects.csv",
    reader="csv",
    rename_map={
        "ID": "shipment_source_id",
        "Warehouse_block": "warehouse_block",
        "Mode_of_Shipment": "mode_of_shipment",
        "Customer_care_calls": "customer_care_calls",
        "Customer_rating": "customer_rating",
        "Cost_of_the_Product": "cost_of_the_product",
        "Prior_purchases": "prior_purchases",
        "Product_importance": "product_importance",
        "Gender": "gender",
        "Discount_offered": "discount_offered",
        "Weight_in_gms": "weight_in_gms",
        "Reached.on.Time_Y.N": "reached_on_time_flag",
    },
    date_columns=(),
    numeric_columns=("cost_of_the_product", "discount_offered", "weight_in_gms"),
    integer_columns=("shipment_source_id", "customer_care_calls", "customer_rating", "prior_purchases", "reached_on_time_flag"),
    identifier_columns=("shipment_source_id",),
)

AMAZON_REVIEWS_DATASET = DatasetConfig(
    source_system="AMAZON_REVIEWS",
    input_filename="amazon_reviews_multilingual_US_v1_00.csv",
    output_filename="amazon_reviews_staging.csv",
    reject_filename="amazon_reviews_rejects.csv",
    reader="csv",
    rename_map={
        "marketplace": "marketplace",
        "customer_id": "customer_id",
        "review_id": "review_id",
        "product_id": "product_id",
        "product_parent": "product_parent",
        "product_title": "product_title",
        "product_category": "product_category",
        "star_rating": "star_rating",
        "helpful_votes": "helpful_votes",
        "total_votes": "total_votes",
        "vine": "vine",
        "verified_purchase": "verified_purchase",
        "review_headline": "review_headline",
        "review_body": "review_body",
        "review_date": "review_date",
    },
    date_columns=("review_date",),
    numeric_columns=("star_rating", "helpful_votes", "total_votes"),
    integer_columns=("star_rating", "helpful_votes", "total_votes"),
    identifier_columns=("customer_id", "review_id", "product_id"),
)
