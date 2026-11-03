// Server only. Importing the CLI does not instantiate Prisma, edit cron or send.
import assert from "node:assert/strict"
import test from "node:test"
import { parseCampaignArguments, pauseLifecycleCron, restoreLifecycleCron, shouldSkipCheckpoint } from "../scripts/run-branded-campaign.mjs"

test("campaign preview is default; live mode needs a safe explicit wave", () => {
  assert.deepEqual(parseCampaignArguments([]), { apply: false, wave: "preview" })
  assert.deepEqual(parseCampaignArguments(["--apply", "--wave", "20261103-invite"]), { apply: true, wave: "20261103-invite" })
  for (const args of [["--apply"], ["--apply", "--wave", "../escape"], ["--wave", "--apply"], ["--apply", "--preview", "--wave", "test"], ["--unknown"]]) {
    assert.throws(() => parseCampaignArguments(args))
  }
})

test("cron pause and restore touch only three exact lifecycle tags", () => {
  const unrelated = "*/5 * * * * unrelated-worker # keep-this"
  const original = [
    "41 * * * * registration-worker # automart-registration-reminders",
    "20 12 * * * signup-worker # automart-signup-nudge",
    "5 8 * * * weekly-worker # automart-weekly-digest",
    unrelated,
    "# disabled-worker # automart-signup-nudge",
    "",
  ].join("\n")
  const paused = pauseLifecycleCron(original, "test")
  assert.equal(paused.changed, 3)
  assert.ok(paused.cron.includes(unrelated))
  assert.equal(pauseLifecycleCron(paused.cron, "test").changed, 0)
  const edited = paused.cron + "\n0 1 * * * independently-added-job\n"
  const restored = restoreLifecycleCron(edited, "test")
  assert.equal(restored.changed, 3)
  assert.equal(restored.cron, original + "\n0 1 * * * independently-added-job\n")
  assert.equal(restoreLifecycleCron(paused.cron, "another-wave").changed, 0)
})

test("only definite rejected attempts are resumed; uncertain sends never duplicate", () => {
  assert.equal(shouldSkipCheckpoint(undefined), false)
  assert.equal(shouldSkipCheckpoint({ status: "RETRYABLE" }), false)
  for (const status of ["ATTEMPTED", "SENT", "BLOCKED", "SKIPPED"]) assert.equal(shouldSkipCheckpoint({ status }), true)
})
