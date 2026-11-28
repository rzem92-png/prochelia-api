import test from "node:test";
import assert from "node:assert/strict";
import { decideSafeVisionAction } from "../src/live-safe-vision-policy.js";

const healthy = { detectorHealthy: true, enforcementHealthy: true, confidence: 0.92,
  severity: "high", targetTrackReliable: true, policyAllowsBlur: true };

test("reliable localized risk selects targeted blur", () => {
  assert.equal(decideSafeVisionAction(healthy).action, "targeted_blur");
});
test("unreliable tracking widens the mask", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, targetTrackReliable: false }).action, "expanded_blur");
});
test("detector failure fails closed", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, detectorHealthy: false }).action, "full_frame_shield");
});
test("enforcement failure fails closed", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, enforcementHealthy: false }).action, "full_frame_shield");
});
test("critical or imminent risk pauses LIVE", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, severity: "critical" }).action, "pause_live");
  assert.equal(decideSafeVisionAction({ ...healthy, imminentDanger: true }).action, "pause_live");
});
test("context does not automatically bypass protection when localization is reliable", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, context: "journalism", severity: "medium" }).action, "targeted_blur");
});
test("context with uncertain localization receives expanded blur", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, context: "journalism", severity: "medium", targetTrackReliable: false }).action, "expanded_blur");
});
test("low-confidence low-risk signal does not over-enforce", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, confidence: 0.3, severity: "low" }).action, "allow");
});
test("policy that forbids blur requires interruption", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, policyAllowsBlur: false }).action, "pause_live");
});
test("invalid signal fails closed", () => {
  assert.equal(decideSafeVisionAction({ ...healthy, confidence: 2 }).action, "full_frame_shield");
});
