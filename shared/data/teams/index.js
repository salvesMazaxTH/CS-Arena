import { pyreLegion } from "./prebuilt/pyre_legion.js";
import { tideAndWard } from "./prebuilt/tide_and_ward.js";
import { freeCompany } from "./prebuilt/free_company.js";
import { ironlads } from "./prebuilt/ironlads.js";
import { justHealDrex } from "./prebuilt/just_heal_drex.js";
import { arcaneWinter } from "./prebuilt/arcane_winter.js";
import { bedrockCourt } from "./prebuilt/bedrock_court.js";
import { shadowCovenant } from "./prebuilt/shadow_covenant.js";

export {
  TEAM_SIZE,
  MAX_TEAM_EMBLEMS,
  validateTeamComposition,
} from "./validateTeam.js";

export const PREBUILT_TEAMS = [
  pyreLegion,
  tideAndWard,
  freeCompany,
  ironlads,
  justHealDrex,
  arcaneWinter,
  bedrockCourt,
  shadowCovenant,
];
