package com.project.ecommerce.notification.service;

public interface EmailService {

    void send(String to, String subject, String body);
}
