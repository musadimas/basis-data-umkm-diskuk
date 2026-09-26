import assert from "node:assert/strict";
import test from "node:test";
import registerWatchdog from "../src/hooks/watchdog.js";

test("watchdog schedules a sanitized health probe", async()=>{ const tasks=[]; let calls=0; const result=registerWatchdog({schedule:(_cron,fn)=>{tasks.push(fn);}},{database:{raw:async()=>{calls++;return {rows:[]};}},logger:{error:assert.fail}}); await tasks[0](); assert.ok(calls >= 3); assert.equal(typeof result.run,"function"); assert.equal(typeof result.cleanup,"function"); });
