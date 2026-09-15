export default {
  name: "Weyne",
  portrait: "/assets/portraits/weyne.webp",

  unreleased: true,

  HP: 300,
  Attack: 305,
  Defense: 60,
  Speed: 80,

  classKey: "marksman",
  species: ["human", "enhanced"],

  elementalAffinities: ["ice"],

  // So the Steady and Stillness indicators show from turn 1 instead of only
  // appearing once her passive first touches them.
  initialRuntime: { weyneSteady: 0, weyneStillness: 0 },
};
