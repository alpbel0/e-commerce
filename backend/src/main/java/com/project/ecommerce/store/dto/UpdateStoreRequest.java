package com.project.ecommerce.store.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;

public record UpdateStoreRequest(
    String name,
    String description,
    @Email(message = "contactEmail must be a valid email address") String contactEmail,
    String contactPhone,
    String status
) {

    @AssertTrue(message = "name must not be blank")
    public boolean isNameValid() {
        return name == null || !name.isBlank();
    }

    @AssertTrue(message = "contactPhone must not be blank")
    public boolean isContactPhoneValid() {
        return contactPhone == null || !contactPhone.isBlank();
    }

    @AssertTrue(message = "status must not be blank")
    public boolean isStatusValid() {
        return status == null || !status.isBlank();
    }
}
