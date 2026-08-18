package com.dangt.aitranslator.backend.payment;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentCheckoutService
            paymentCheckoutService;
    private final CurrentUserService
            currentUserService;

    public PaymentController(
            PaymentCheckoutService
                    paymentCheckoutService,
            CurrentUserService
                    currentUserService
    ) {
        this.paymentCheckoutService =
                paymentCheckoutService;
        this.currentUserService =
                currentUserService;
    }

    @PostMapping("/checkout")
    public PaymentCheckoutResponse checkout(
            @Valid
            @RequestBody
            PaymentCheckoutRequest request,
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(
                                jwt
                        );

        return paymentCheckoutService
                .createCheckout(
                        user.getId(),
                        request
                );
    }
}
