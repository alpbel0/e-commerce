package com.project.ecommerce.payment.service;

import com.project.ecommerce.payment.config.StripeProperties;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StripePaymentService {

    private final StripeProperties properties;

    public StripePaymentService(StripeProperties properties) {
        this.properties = properties;
    }

    public PaymentIntent createPaymentIntent(String orderId, BigDecimal amount, String currency) {
        ensureConfigured();
        Stripe.apiKey = properties.getSecretKey();
        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(toMinorUnits(amount))
                .setCurrency(normalizeCurrency(currency))
                .putMetadata("orderId", orderId)
                .setAutomaticPaymentMethods(
                    PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true)
                        .build()
                )
                .build();
            return PaymentIntent.create(params);
        } catch (StripeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Stripe payment intent could not be created", ex);
        }
    }

    public Refund createRefund(String paymentIntentId, BigDecimal amount, String currency, String reason) {
        ensureConfigured();
        Stripe.apiKey = properties.getSecretKey();
        try {
            RefundCreateParams.Builder builder = RefundCreateParams.builder()
                .setPaymentIntent(paymentIntentId)
                .setAmount(toMinorUnits(amount));
            if (reason != null && !reason.isBlank()) {
                builder.putMetadata("reason", reason.trim());
            }
            builder.putMetadata("currency", normalizeCurrency(currency));
            return Refund.create(builder.build());
        } catch (StripeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Stripe refund could not be created", ex);
        }
    }

    public Event constructWebhookEvent(String payload, String signatureHeader) {
        if (properties.getWebhookSecret() == null || properties.getWebhookSecret().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Stripe webhook secret is not configured");
        }
        try {
            return Webhook.constructEvent(payload, signatureHeader, properties.getWebhookSecret());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Stripe webhook signature", ex);
        }
    }

    private void ensureConfigured() {
        if (properties.getSecretKey() == null || properties.getSecretKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Stripe secret key is not configured");
        }
    }

    private long toMinorUnits(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP)
            .multiply(new BigDecimal("100"))
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact();
    }

    private String normalizeCurrency(String currency) {
        if (currency == null || currency.isBlank()) {
            return "try";
        }
        return currency.trim().toLowerCase(Locale.ROOT);
    }
}
