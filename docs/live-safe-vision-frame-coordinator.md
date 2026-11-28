# Safe Vision frame coordinator

A deterministic coordinator connects the policy decision, mask-plan validator and room/stream binding validator. It returns only a decision contract: allow, pause, shield, or transform request. The transform result must still be verified by the viewer-output guard before fan-out.

Runtime integration must:
1. authenticate the source and bind frame metadata to room/stream;
2. verify signature and persistent replay sequence;
3. evaluate policy and mask-plan contracts;
4. transform or shield in the media path;
5. verify the actual output and all fan-out paths;
6. only then release to viewers;
7. if verification fails, shield and confirm pause; if pause cannot be confirmed, trigger the emergency fail-closed path.

This module is not an actual video-processing implementation.
