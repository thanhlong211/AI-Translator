package com.dangt.aitranslator.backend.payment;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/payments/webhooks"
)
public class LemonSqueezyWebhookController {

    private final LemonSqueezyWebhookService
            webhookService;

    public LemonSqueezyWebhookController(
            LemonSqueezyWebhookService
                    webhookService
    ) {
        this.webhookService =
                webhookService;
    }

    @PostMapping(
            value = "/lemon-squeezy",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public LemonSqueezyWebhookResponse receive(
            @RequestBody
            byte[] rawBody,

            @RequestHeader(
                    value = "X-Signature",
                    required = false
            )
            String signature,

            @RequestHeader(
                    value = "X-Event-Name",
                    required = false
            )
            String eventName
    ) {
        return webhookService.handle(
                rawBody,
                signature,
                eventName
        );
    }
}
