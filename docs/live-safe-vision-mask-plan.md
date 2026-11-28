# Safe Vision mask-plan contract

Mask metadata is bounded and ephemeral. Coordinates use normalized frame space. Target masks require a track ID and high confidence. Plans expire quickly and cannot be reused indefinitely. Any invalid/expired plan falls back to a full-frame shield. Full-frame shield has no target boxes.

This is validation only. It does not track objects, generate masks, transform frames, render blur, or verify viewer output. Production implementation must bind frame/stream/room/version, authenticated policy decision, model version, and monotonic sequence to prevent cross-frame/cross-room replay.
