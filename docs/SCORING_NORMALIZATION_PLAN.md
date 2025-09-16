Scoring and Normalization Plan

Phase 1 (implemented)
- Localized language signals (JP/NL/FR/ES/IT/DE/DA/SV) added to cosy keywords.
- Negative cues expanded (hostel/dorm/capsule/etc.).
- Type filtering during ingestion: skip hostel, capsule_hotel, apartment(_hotel).
- Confidence weighting: review-count bonus applied (log-based, capped).
- Chain and scale penalties retained; parts exposed via cosyParts.
- Ad-hoc score now considers review confidence for Places-only results.

Phase 2 (planned)
- Persist robust city/country stats (median, IQR) in Supabase (normalizer_stats).
- Compute normalized city/country scores and blend with base: final = 0.5·base + 0.3·norm_city + 0.2·norm_country.
- Confidence multiplier and floor checks (min rating, min reviews for “high”).
- Guides and featured use normalized scores for ordering/thresholds.

Phase 3 (planned)
- Multilingual text embeddings for cosy classification.
- Lightweight visual warmth proxy for images.
- Admin labeling workflow; periodic weight/threshold tuning.
