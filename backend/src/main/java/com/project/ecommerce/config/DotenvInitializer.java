package com.project.ecommerce.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;

public class DotenvInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final String PROPERTY_SOURCE_NAME = "localDotenv";

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        Path dotenvPath = Path.of(".env");
        if (!Files.isRegularFile(dotenvPath)) {
            return;
        }

        Map<String, Object> values = new LinkedHashMap<>();
        try {
            for (String line : Files.readAllLines(dotenvPath)) {
                parseLine(line, values);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read local .env file", ex);
        }

        if (!values.isEmpty()) {
            applicationContext.getEnvironment()
                .getPropertySources()
                .addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, values));
        }
    }

    private static void parseLine(String line, Map<String, Object> values) {
        String trimmed = line.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#")) {
            return;
        }
        int separator = trimmed.indexOf('=');
        if (separator <= 0) {
            return;
        }
        String key = trimmed.substring(0, separator).trim();
        String value = trimmed.substring(separator + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length() - 1);
        }
        values.putIfAbsent(key, value);
    }

    public static void addTo(SpringApplication application) {
        application.addInitializers(new DotenvInitializer());
    }
}
