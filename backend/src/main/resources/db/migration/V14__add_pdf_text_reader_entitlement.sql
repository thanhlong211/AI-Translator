-- Batch 14.2: PDF Text Reader entitlement.
-- FREE remains locked; PRO and MANGA_PLUS can open/translate text-based PDF.

INSERT INTO plan_features (plan_code, feature_key, enabled) VALUES
    ('FREE', 'pdfTextReader', FALSE),
    ('PRO', 'pdfTextReader', TRUE),
    ('MANGA_PLUS', 'pdfTextReader', TRUE);
