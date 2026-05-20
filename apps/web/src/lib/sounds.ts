import { defineSound } from "@web-kits/audio";

export const click = defineSound({
  source: { type: "sine", frequency: { start: 800, end: 500 } },
  envelope: { decay: 0.04 },
  gain: 0.18,
});

export const success = defineSound({
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
});

export const error = defineSound({
  source: { type: "sine", frequency: { start: 220, end: 80 } },
  envelope: { decay: 0.15 },
  gain: 0.22,
});

export const dialogOpen = defineSound({
  source: { type: "sine", frequency: { start: 350, end: 550 } },
  envelope: { attack: 0.02, decay: 0.12 },
  gain: 0.14,
});

export const dialogClose = defineSound({
  source: { type: "sine", frequency: { start: 500, end: 320 } },
  envelope: { decay: 0.09 },
  gain: 0.12,
});

export const switchOn = defineSound({
  source: { type: "sine", frequency: { start: 900, end: 1300 } },
  envelope: { decay: 0.05 },
  gain: 0.16,
});

export const switchOff = defineSound({
  source: { type: "sine", frequency: { start: 700, end: 500 } },
  envelope: { decay: 0.05 },
  gain: 0.14,
});

export const download = defineSound({
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
});
