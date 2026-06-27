import { createAvatar } from "@dicebear/core";
import { adventurer } from "@dicebear/collection";
import { MemberAvatar } from "@/types";

// The avatar palettes the picker offers. Hex without '#'.
// Skin tones, light -> dark.
export const SKIN_PALETTE = ["ffe0bd", "f1c27d", "e0ac69", "c68642", "8d5524", "5c3a21"];
// Hair colours: black, dark brown, brown, blond, red/auburn, grey/white.
export const HAIR_COLORS = ["1c1c1c", "3d2b1f", "7a5230", "e3c27e", "a23e1e", "d8d8d8"];
// A spread of adventurer hairstyles (short + long).
export const HAIR_VARIANTS = [
  "short01", "short03", "short05", "short08", "short11", "short16",
  "long03", "long07", "long12", "long20",
];

export const DEFAULT_AVATAR: MemberAvatar = {
  style: "adventurer",
  seed: "outside",
  skinColor: SKIN_PALETTE[1],
  hairColor: HAIR_COLORS[1],
  hair: "short03",
};

// A fresh seed per member so faces differ. Called on demand (not at import).
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Build the avatar SVG string. createAvatar is synchronous and fully offline
// (pure JS); rendered via react-native-svg's SvgXml.
export function avatarSvg(avatar: MemberAvatar, size: number): string {
  return createAvatar(adventurer, {
    seed: avatar.seed,
    size,
    skinColor: [avatar.skinColor],
    hairColor: [avatar.hairColor],
    hair: [avatar.hair],
  } as any).toString();
}
