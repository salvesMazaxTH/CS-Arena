import { dieWithTwin, TWIN_BOND_TEXT } from "../pairs/twinBond.js";

export default {
  key: "the_one_that_leaves",
  name: "The One That Leaves",

  description() {
    return `Laiserisa is the sister who answers presence by letting it go — nothing she touches is destroyed, only allowed to stop being. ${TWIN_BOND_TEXT}`;
  },

  onChampionDeath(payload) {
    dieWithTwin(payload, this.name);
  },
};
