<script setup lang="ts">
// ALTCHA captcha (proof-of-work, no third party). Challenges are issued and verified
// by Directus: GET /v1/auth/captcha/challenge + the auth.login hook.
import "altcha";
import "altcha/i18n/id";
import type { AltchaWidgetElement } from "altcha";

const CHALLENGE_URL = "/panel/v1/auth/captcha/challenge";

const widget = useTemplateRef<AltchaWidgetElement>("widget");
const payload = ref<string | null>(null);

function isVerifiedEvent(event: Event): event is CustomEvent<{ payload?: string }> {
  return "detail" in event;
}

function onVerified(event: Event) {
  if (isVerifiedEvent(event)) payload.value = event.detail?.payload ?? null;
}

function onExpired() {
  payload.value = null;
}

/** Payload ready to submit; runs verification when the user has not ticked the captcha yet. */
async function solve(): Promise<string | null> {
  if (payload.value) return payload.value;
  const result = await widget.value?.verify();
  payload.value = result?.payload ?? null;
  return payload.value;
}

/** Payloads are single-use on the server; reset after every submission. */
function reset() {
  payload.value = null;
  widget.value?.reset();
}

defineExpose({ solve, reset });
</script>

<template>
  <altcha-widget
    ref="widget"
    :challenge="CHALLENGE_URL"
    type="checkbox"
    auto="onfocus"
    language="id"
    class="block"
    @verified="onVerified"
    @expired="onExpired"
  />
</template>
