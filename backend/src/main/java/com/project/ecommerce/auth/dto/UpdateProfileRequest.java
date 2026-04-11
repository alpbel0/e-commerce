package com.project.ecommerce.auth.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
    @Size(min = 1, message = "First name cannot be empty")
    String firstName,

    @Size(min = 1, message = "Last name cannot be empty")
    String lastName,

    @Size(max = 20, message = "Phone must be at most 20 characters")
    String phone,

    @Size(max = 500, message = "Address must be at most 500 characters")
    String address,

    @Size(max = 500, message = "Profile image URL must be at most 500 characters")
    String profileImageUrl
) {}
