package com.project.ecommerce.auth.web;

import com.project.ecommerce.auth.dto.MessageResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@SecurityRequirement(name = "bearerAuth")
public class AdminPingController {

    @GetMapping("/ping")
    public MessageResponse ping() {
        return new MessageResponse("admin access granted");
    }
}
