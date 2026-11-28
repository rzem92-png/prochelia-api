# Safe Vision latency budget

Trusted runtime must measure each stage with a monotonic clock. No viewer release is permitted until transformation and output verification complete. Total pipeline latency is compared against an environment-configured budget; budget breach fails closed and records bounded metadata for operational review.

Metrics: decision latency, transform latency, verification latency, release latency, total latency, budget. Record no raw frames or content. Define SLOs per transport/device/region only after real benchmark data; don't hard-code unvalidated universal latency targets.
