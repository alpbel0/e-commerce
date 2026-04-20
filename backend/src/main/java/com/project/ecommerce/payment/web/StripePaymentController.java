package com.project.ecommerce.payment.web;

import com.project.ecommerce.payment.dto.CreateStripePaymentIntentRequest;
import com.project.ecommerce.payment.dto.CreateStripePaymentIntentResponse;
import com.project.ecommerce.payment.dto.CreateStripeRefundRequest;
import com.project.ecommerce.payment.dto.CreateStripeRefundResponse;
import com.project.ecommerce.payment.dto.SyncStripePaymentIntentRequest;
import com.project.ecommerce.payment.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments/stripe")
public class StripePaymentController {

    private final PaymentService paymentService;

    public StripePaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/create-intent")
    public CreateStripePaymentIntentResponse createIntent(@Valid @RequestBody CreateStripePaymentIntentRequest request) {
        return paymentService.createStripePaymentIntent(request);
    }

    @PostMapping("/refunds")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateStripeRefundResponse createRefund(@Valid @RequestBody CreateStripeRefundRequest request) {
        return paymentService.createStripeRefund(request);
    }

    @PostMapping("/sync-intent")
    public ResponseEntity<Void> syncIntent(@Valid @RequestBody SyncStripePaymentIntentRequest request) {
        paymentService.syncStripePaymentIntent(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
        @RequestBody String payload,
        @RequestHeader("Stripe-Signature") String signatureHeader
    ) {
        paymentService.handleStripeWebhook(payload, signatureHeader);
        return ResponseEntity.ok().build();
    }
}
