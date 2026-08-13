-- Batch 14.3: PDF OCR Reader entitlement.
-- OCR runs locally on Desktop; translation still uses normal plan quota.

INSERT INTO plan_features (plan_code, feature_key, enabled) VALUES
    ('FREE', 'pdfOcrReader', FALSE),
    ('PRO', 'pdfOcrReader', TRUE),
    ('MANGA_PLUS', 'pdfOcrReader', TRUE);
