import { MAX_AMMO } from "./ammo.js";

export default {
  name: "Zyrelle",
  portrait: "/assets/portraits/zyrelle.webp",

  HP: 300,
  Attack: 325,
  Defense: 55,
  Speed: 90,
  Critical: 30,

  classKey: "marksman",
  species: ["elf"],

  // So the ammo indicator shows a full cylinder from turn 1 instead of only
  // appearing after her first shot.
  initialRuntime: { zyrelleAmmo: MAX_AMMO },
};
