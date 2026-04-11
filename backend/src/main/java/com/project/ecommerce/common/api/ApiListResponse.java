package com.project.ecommerce.common.api;

import java.util.List;

public record ApiListResponse<T>(
    List<T> items,
    int count
) {
}
