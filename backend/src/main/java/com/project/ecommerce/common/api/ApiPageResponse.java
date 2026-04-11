package com.project.ecommerce.common.api;

import java.util.List;

public record ApiPageResponse<T>(
    List<T> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {
}
