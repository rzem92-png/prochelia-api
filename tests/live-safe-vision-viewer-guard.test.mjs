import test from "node:test";
import assert from "node:assert/strict";
import { validateProtectedViewerOutput, safeVisionEscalation } from "../src/live-safe-vision-viewer-guard.js";

const good = { transformHealthy:true, outputVerified:true, sourceMediaForwarded:false,
 protectedPaths:["live","guest_preview","recording","clip","replay","thumbnail"],
 maskApplied:true, shieldApplied:false };
test("verified mask and every viewer path allow continuation",()=>assert.equal(validateProtectedViewerOutput(good).ok,true));
test("missing replay protection fails closed",()=>assert.equal(validateProtectedViewerOutput({...good,protectedPaths:["live","guest_preview","recording","clip","thumbnail"]}).action,"full_frame_shield"));
test("unmasked source forwarded requires LIVE pause",()=>assert.equal(validateProtectedViewerOutput({...good,sourceMediaForwarded:true}).action,"pause_live"));
test("transform failure shields viewers",()=>assert.equal(validateProtectedViewerOutput({...good,transformHealthy:false}).action,"full_frame_shield"));
test("unverified output shields viewers",()=>assert.equal(validateProtectedViewerOutput({...good,outputVerified:false}).action,"full_frame_shield"));
test("mask missing fails closed",()=>assert.equal(validateProtectedViewerOutput({...good,maskApplied:false}).action,"full_frame_shield"));
test("pause command verified returns paused state",()=>assert.equal(safeVisionEscalation({ok:false,reason:"bad"},true).action,"paused"));
test("cannot verify pause escalates fail closed",()=>assert.equal(safeVisionEscalation({ok:false},false).action,"emergency_fail_closed"));
test("custom required path set is supported",()=>assert.equal(validateProtectedViewerOutput({...good,protectedPaths:["live"],maskApplied:true},["live"]).ok,true));
