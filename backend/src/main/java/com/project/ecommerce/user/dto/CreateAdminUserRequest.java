package com.project.ecommerce.user.dto;

import com.project.ecommerce.auth.domain.RoleType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateAdminUserRequest(
    @Email(message = "email must be valid")
    @NotBlank(message = "email is required")
    String email,

    @NotBlank(message = "firstName is required")
    @Size(min = 2, max = 255, message = "firstName must be between 2 and 255 characters")
    String firstName,

    @NotBlank(message = "lastName is required")
    @Size(min = 2, max = 255, message = "lastName must be between 2 and 255 characters")
    String lastName,

    @NotBlank(message = "password is required")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,64}$",
        message = "Password must be 8-64 chars and include upper, lower, digit, and special char"
    )
    String password,

    @NotNull(message = "role is required")
    RoleType role,

    String storeName,

    Boolean active
) {
}
