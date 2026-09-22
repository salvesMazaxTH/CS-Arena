import totalBlock from "../generic/totalBlock.js";
import basicStrike from "../generic/basicStrike.js";

// Rootward is permanently Inert (see passive.js) and will practically never
// get to use either of these — its value lives entirely in its passive.
const yresaSentinelSkills = [totalBlock, basicStrike];

export default yresaSentinelSkills;
