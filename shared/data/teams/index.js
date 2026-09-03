import { pyreLegion } from "./prebuilt/pyre_legion.js";
import { tideAndWard } from "./prebuilt/tide_and_ward.js";
import { freeCompany } from "./prebuilt/free_company.js";

export {
  TEAM_SIZE,
  MAX_TEAM_EMBLEMS,
  validateTeamComposition,
} from "./validateTeam.js";

export const PREBUILT_TEAMS = [pyreLegion, tideAndWard, freeCompany];
