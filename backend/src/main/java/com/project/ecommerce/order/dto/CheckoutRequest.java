package com.project.ecommerce.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CheckoutRequest(
    @NotNull CheckoutPaymentMethod paymentMethod,
    @NotBlank String shippingAddressLine1,
    String shippingAddressLine2,
    @NotBlank String shippingCity,
    String shippingState,
    String shippingPostalCode,
    @NotBlank String shippingCountry,
    String customerPhone,
    String notes
) {
}
