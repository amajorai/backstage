import { defineSound } from "@web-kits/audio";
import { useAppSettingsStore } from "@/stores/use-app-settings-store";

function guard(fn: () => void): () => void {
  return () => {
    if (useAppSettingsStore.getState().soundsEnabled) fn();
  };
}

export const click = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 800, end: 500 } },
    envelope: { decay: 0.04 },
    gain: 0.18,
  })
);

export const success = guard(
  defineSound({
    layers: [
      {
        source: { type: "sine", frequency: 523 },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0 },
        gain: 0.22,
      },
      {
        source: { type: "sine", frequency: 784 },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0 },
        gain: 0.18,
        delay: 0.12,
      },
    ],
  })
);

export const error = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 220, end: 80 } },
    envelope: { decay: 0.15 },
    gain: 0.22,
  })
);

export const dialogOpen = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 350, end: 550 } },
    envelope: { attack: 0.02, decay: 0.12 },
    gain: 0.14,
  })
);

export const dialogClose = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 500, end: 320 } },
    envelope: { decay: 0.09 },
    gain: 0.12,
  })
);

export const switchOn = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 900, end: 1300 } },
    envelope: { decay: 0.05 },
    gain: 0.16,
  })
);

export const switchOff = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 700, end: 500 } },
    envelope: { decay: 0.05 },
    gain: 0.14,
  })
);

export const download = guard(
  defineSound({
    layers: [
      {
        source: { type: "sine", frequency: { start: 420, end: 160 } },
        envelope: { decay: 0.07 },
        gain: 0.28,
      },
      {
        source: { type: "triangle", frequency: { start: 600, end: 220 } },
        envelope: { decay: 0.09 },
        gain: 0.14,
      },
    ],
  })
);

export const delete_ = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 300, end: 120 } },
    envelope: { decay: 0.12 },
    gain: 0.2,
  })
);

export const select = guard(
  defineSound({
    source: { type: "sine", frequency: { start: 600, end: 750 } },
    envelope: { decay: 0.03 },
    gain: 0.12,
  })
);

export const hover = guard(
  defineSound({
    source: { type: "sine", frequency: 1200 },
    envelope: { decay: 0.02 },
    gain: 0.06,
  })
);
