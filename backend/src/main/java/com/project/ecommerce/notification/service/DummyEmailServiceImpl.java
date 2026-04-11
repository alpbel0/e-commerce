package com.project.ecommerce.notification.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class DummyEmailServiceImpl implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(DummyEmailServiceImpl.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("[MOCK EMAIL SENT] -> To: {}, Subject: {}, Body: {}", to, subject, body);
    }
}
