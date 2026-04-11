package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.AccessScopeResponse;
import com.project.ecommerce.auth.service.AccessScopeService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/me")
@SecurityRequirement(name = "bearerAuth")
public class AccessScopeController {

    private final AccessScopeService accessScopeService;

    public AccessScopeController(AccessScopeService accessScopeService) {
        this.accessScopeService = accessScopeService;
    }

    @GetMapping("/scope")
    public AccessScopeResponse scope() {
        return accessScopeService.currentScope();
    }
}
