export default {
  name: "Weyne",
  releaseDate: "2026-09-27",
  portrait: "/assets/portraits/weyne.webp",

  unreleased: true,

  HP: 300,
  Attack: 305,
  Defense: 60,
  Speed: 80,

  elementalAffinities: ["ice"],
  classKey: "marksman",
  species: ["human", "enhanced"],

  // So the Steady and Stillness indicators show from turn 1 instead of only
  // appearing once her passive first touches them.
  initialRuntime: { weyneSteady: 0, weyneStillness: 0 },
};
