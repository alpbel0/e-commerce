package com.project.ecommerce.common.api;

public record FieldValidationError(
    String field,
    String message
) {
}
