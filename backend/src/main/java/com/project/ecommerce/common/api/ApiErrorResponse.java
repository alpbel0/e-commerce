package com.project.ecommerce.common.api;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiErrorResponse(
    OffsetDateTime timestamp,
    int status,
    String error,
    String message,
    String path,
    List<FieldValidationError> fieldErrors
) {
}
