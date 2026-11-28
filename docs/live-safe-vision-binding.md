# Safe Vision binding and replay guard

Mask decisions must bind to stream ID, room ID, room version, policy version, model version, monotonic sequence, issued/expiry timestamps. Signature verification must be performed by trusted runtime before this pure validator is called. Persistent replay protection is required in runtime storage; the in-memory expected last sequence is not enough.

Mismatch, stale/future timestamp, invalid expiry, signature failure or replay/out-of-order event => full-frame shield and safety escalation.
