package com.project.ecommerce.config;

import java.util.List;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class AppInfoContributor implements InfoContributor {

    private final Environment environment;

    public AppInfoContributor(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("application", "ecommerce-backend");
        builder.withDetail("profiles", List.of(environment.getActiveProfiles()));
    }
}
