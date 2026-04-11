package com.project.ecommerce.auth.dto;

public record ForgotPasswordResponse(
    String message,
    String resetToken
) {
}
