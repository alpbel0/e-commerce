package com.project.ecommerce;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import com.project.ecommerce.config.DotenvInitializer;

@SpringBootApplication
public class ECommerceApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(ECommerceApplication.class);
        DotenvInitializer.addTo(application);
        application.run(args);
    }
}
