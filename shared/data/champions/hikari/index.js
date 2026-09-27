import hikariData from "./data.js";
import hikariSkills from "./skills.js";
import hikariPassive from "./passive.js";

const hikari = {
  ...hikariData,
  skills: hikariSkills,
  passive: hikariPassive,
};

export default hikari;
