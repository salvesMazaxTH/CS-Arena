export default {
  name: "Stoneward Colossus",
  releaseDate: "2026-09-23",
  portrait: "/assets/portraits/yresa_colossus.webp",

  // Every stat is scaled at spawn by the number of Stonewards fused into it.
  HP: 50,
  Attack: 50,
  Defense: 80,
  Speed: 10,

  classKey: "tank",
  species: ["golem"],
  elementalAffinities: ["earth"],

  // Minion: enters play through Become the Mountain, never through selection.
  entityType: "minion",
};
