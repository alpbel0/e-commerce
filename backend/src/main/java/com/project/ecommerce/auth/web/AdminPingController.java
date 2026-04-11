package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.AdminUserSummaryResponse;
import com.project.ecommerce.auth.dto.MessageResponse;
import com.project.ecommerce.auth.service.AccessScopeService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@SecurityRequirement(name = "bearerAuth")
public class AdminPingController {

    private final AccessScopeService accessScopeService;

    public AdminPingController(AccessScopeService accessScopeService) {
        this.accessScopeService = accessScopeService;
    }

    @GetMapping("/ping")
    public MessageResponse ping() {
        return new MessageResponse("admin access granted");
    }

    @GetMapping("/users")
    public List<AdminUserSummaryResponse> users() {
        return accessScopeService.allUsersForAdmin();
    }
}
