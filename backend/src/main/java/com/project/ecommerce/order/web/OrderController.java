package com.project.ecommerce.order.web;

import com.project.ecommerce.common.api.ApiPageResponse;
import com.project.ecommerce.order.dto.CheckoutRequest;
import com.project.ecommerce.order.dto.CheckoutResponse;
import com.project.ecommerce.order.dto.OrderDetailResponse;
import com.project.ecommerce.order.dto.OrderItemResponse;
import com.project.ecommerce.order.dto.OrderSummaryResponse;
import com.project.ecommerce.order.dto.RequestReturnRequest;
import com.project.ecommerce.order.dto.UpdateOrderStatusRequest;
import com.project.ecommerce.order.dto.UpdatePaymentStatusRequest;
import com.project.ecommerce.order.dto.UpdateReturnStatusRequest;
import com.project.ecommerce.order.service.OrderService;
import com.project.ecommerce.shipment.dto.ShipmentSummaryResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request) {
        return orderService.checkout(request);
    }

    @GetMapping
    public ApiPageResponse<OrderSummaryResponse> listOrders(
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String status
    ) {
        return orderService.listOrders(page, size, sort, status);
    }

    @GetMapping("/{orderId}")
    public OrderDetailResponse getOrder(@PathVariable UUID orderId) {
        return orderService.getOrderDetail(orderId);
    }

    @PatchMapping("/{orderId}/status")
    public OrderDetailResponse updateOrderStatus(
        @PathVariable UUID orderId,
        @Valid @RequestBody UpdateOrderStatusRequest request
    ) {
        return orderService.updateOrderStatus(orderId, request);
    }

    @PatchMapping("/{orderId}/payment-status")
    public OrderDetailResponse updatePaymentStatus(
        @PathVariable UUID orderId,
        @Valid @RequestBody UpdatePaymentStatusRequest request
    ) {
        return orderService.updatePaymentStatus(orderId, request);
    }

    @PostMapping("/items/{orderItemId}/return")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderItemResponse requestReturn(
        @PathVariable UUID orderItemId,
        @Valid @RequestBody RequestReturnRequest request
    ) {
        return orderService.requestReturn(orderItemId, request);
    }

    @PatchMapping("/items/{orderItemId}/return-status")
    public OrderItemResponse updateReturnStatus(
        @PathVariable UUID orderItemId,
        @Valid @RequestBody UpdateReturnStatusRequest request
    ) {
        return orderService.updateReturnStatus(orderItemId, request);
    }

    @GetMapping("/{orderId}/shipment")
    public ShipmentSummaryResponse getOrderShipment(@PathVariable UUID orderId) {
        return orderService.getOrderShipment(orderId);
    }
}
