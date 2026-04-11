package com.project.ecommerce.order.dto;

import java.math.BigDecimal;
import java.util.List;

public record CheckoutResponse(
    List<CheckoutOrderResponse> createdOrders,
    int totalOrdersCreated,
    BigDecimal grandTotal
) {
}
