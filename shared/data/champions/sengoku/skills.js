import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const sengokuSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================
  {
    key: "ravening_strike",
    name: "Ravening Strike",
    bf: 70,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return {
        en: `Sengoku brings down a blow heavy with old fury, dealing <b>physical damage</b> to the chosen target.`,
        pt: `Sengoku desfere um golpe carregado de fúria antiga, causando <b>dano físico</b> no alvo escolhido.`,
      };
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "dragonfire_bolt",
    name: "Dragonfire Bolt",
    bf: 45,
    contact: false,
    damageMode: "piercing",
    piercingPercentage: 50,
    priority: 0,
    element: "fire",

    description() {
      return {
        en: `Sengoku fires from his hand a bolt of dragonfire that burns straight through armor, dealing <b>Fire magical damage</b> to the chosen target with <b>${this.piercingPercentage}%</b> piercing.`,
        pt: `Sengoku dispara da mão um raio de fogo dracônico que queima direto através da armadura, causando <b>dano mágico de Fogo</b> no alvo escolhido com <b>${this.piercingPercentage}%</b> de perfuração.`,
      };
    },

    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "primordial_awakening",
    name: "Primordial Awakening",
    duration: 3,
    transformInto: "sengoku_primordial",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    description() {
      return {
        en: `Sengoku sheds the centuries and unfolds into his primordial draconic shape for <b>${this.duration}</b> turn(s), replacing his skills, his passive and his stats.`,
        pt: `Sengoku se desfaz dos séculos e se revela em sua forma draconiana primordial por <b>${this.duration}</b> turno(s), substituindo suas habilidades, sua passiva e seus atributos.`,
      };
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      context.requestChampionMutation?.({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.duration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      return {
        log: {
          en: `${formatChampionName(user)} awakens his <b>Primordial Form</b> for ${this.duration} turn(s)!`,
          pt: `${formatChampionName(user)} desperta sua <b>Forma Primordial</b> por ${this.duration} turno(s)!`,
        },
      };
    },
  },
];

export default sengokuSkills;
