import { THUNDER_FLAT_BONUS } from "../tony_raiturus/passive.js";

export default {
  key: "sound_and_light_together",
  name: "Sound and Light Together",

  description() {
    return {
      en: `Nothing about the storm is running ahead of itself any more. Tony Raiturus no longer splits his blows: every strike lands whole and at once, carrying <b>${THUNDER_FLAT_BONUS}</b> bonus damage, and <b>cannot be evaded</b>.`,
      pt: `Nada mais nessa tempestade corre à frente de si mesma. Tony Raiturus deixa de dividir seus golpes: todo ataque agora chega inteiro e de uma vez, somando <b>${THUNDER_FLAT_BONUS}</b> de dano bônus, e <b>não pode ser esquivado</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || defender === owner) return;

    return { damage: Number(damage) + THUNDER_FLAT_BONUS };
  },
};
