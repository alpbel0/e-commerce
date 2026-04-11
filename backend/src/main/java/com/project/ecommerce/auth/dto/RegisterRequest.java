package com.project.ecommerce.auth.dto;

import com.project.ecommerce.auth.domain.RoleType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @Email @NotBlank String email,
    @NotBlank @Size(min = 2, max = 255) String firstName,
    @NotBlank @Size(min = 2, max = 255) String lastName,
    @NotBlank
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,64}$",
        message = "Password must be 8-64 chars and include upper, lower, digit, and special char"
    )
    String password,
    @NotNull RoleType role,
    String storeName
) {
}
