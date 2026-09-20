import { STARTING_LIVES } from "./passive.js";

export default {
  name: "Killer Meow",
  releaseDate: "2026-09-14",
  portrait: "/assets/portraits/killer_meow.webp",

  unreleased: true,

  HP: 285,
  Attack: 285,
  Defense: 50,
  Speed: 75,
  Critical: 35,

  classKey: "assassin",
  species: ["human", "animal"],

  initialRuntime: { meowLives: STARTING_LIVES },
};
