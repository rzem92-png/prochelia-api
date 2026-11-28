# Safe Vision viewer-output guard

This guard validates the transformation/enforcement result before continuing viewer delivery. It does not implement the transform.

Mandatory coverage includes LIVE viewer delivery, guest preview, recording, clip, replay, and thumbnail. Deployments must enumerate all actual egress paths and extend the list; this list is not assumed exhaustive.

Requirements:
- Raw/unmasked source must never be forwarded to viewer-facing or derivative paths after a safety decision requiring masking.
- Transform and output verification must be healthy.
- All viewer and derivative paths must attest protection.
- Failure defaults to full-frame shield. If source leakage is detected, pause LIVE.
- The system must verify the pause command; if it cannot confirm pause or protection, emergency fail-closed handling is required.
- Guard decisions should be recorded with opaque IDs, policy/model versions, timestamps, and no unnecessary raw media.
