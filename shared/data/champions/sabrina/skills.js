import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const sabrinaSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "tidal_lance",
    name: "Tidal Lance",

    bf: 60,
    chillDuration: 2,

    contact: false,
    priority: 0,

    damageMode: "standard",
    element: "water",
    hitVfx: "tidal_lance",
    description() {
      return {
        en: `Fires a concentrated lance of water at an enemy, dealing <b>Water magical damage</b> and applying <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s).`,
        pt: `Dispara uma lança concentrada de água contra um inimigo, causando <b>dano mágico de Água</b> e aplicando <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "chilled")) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },

  {
    key: "glacial_bind",
    name: "Glacial Bind",

    bf: 85,
    chilledBonusPercent: 25,
    freezeDuration: 1,

    contact: false,
    priority: 0,

    damageMode: "standard",
    element: "ice",
    description() {
      return {
        en: `Conjures a mass of hardened ice around an enemy, dealing <b>Ice magical damage</b>. If the target is already <b>Chilled</b>, this deals <b>${this.chilledBonusPercent}%</b> increased damage and the Chilled effect is consumed and replaced by <b>Frozen</b> for <b>${this.freezeDuration}</b> turn(s).`,
        pt: `Conjura uma massa de gelo endurecido ao redor de um inimigo, causando <b>dano mágico de Gelo</b>. Se o alvo já estiver <b>Gelado</b>, isso causa <b>${this.chilledBonusPercent}%</b> de dano aumentado e o efeito Gelado é consumido e substituído por <b>Congelado</b> por <b>${this.freezeDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const isChilled = target.hasStatusEffect("chilled");

      // The ice feeds on the Chilled it is about to consume.
      const chilledMultiplier = isChilled
        ? 1 + this.chilledBonusPercent / 100
        : 1;
      const baseDamage = (user.Attack * this.bf * chilledMultiplier) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "frozen") && isChilled) {
        target.applyStatusEffect("frozen", this.freezeDuration, context);
      }

      return result;
    },
  },

  {
    key: "deluge_of_winter",
    name: "Deluge of Winter",

    chillDuration: 2,
    freezeDuration: 1,

    contact: false,
    priority: 1,

    isUltimate: true,
    momentumCost: 55,

    damageMode: "standard",
    element: "water",

    hits: [
      { id: "wave", element: "water", type: "magical", bf: 65 },
      { id: "frost", element: "ice", type: "magical", bf: 65 },
    ],

    description() {
      return {
        en: `Unleashes a massive wave that crashes into the target, dealing <b>Water magical damage</b> and applying <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s) (if not already Chilled). The wave then immediately freezes around the target, dealing <b>Ice magical damage</b>. If the target was already <b>Chilled</b> when the wave struck, the Ice hit consumes the Chilled effect and <b>Freezes</b> them for <b>${this.freezeDuration}</b> turn(s) instead.`,
        pt: `Desencadeia uma onda massiva que se choca contra o alvo, causando <b>dano mágico de Água</b> e aplicando <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s) (se ainda não estiver Gelado). A onda então congela imediatamente ao redor do alvo, causando <b>dano mágico de Gelo</b>. Se o alvo já estava <b>Gelado</b> quando a onda o atingiu, o golpe de Gelo consome o efeito Gelado e o <b>Congela</b> por <b>${this.freezeDuration}</b> turno(s) em vez disso.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const wasChilledOnImpact = target.hasStatusEffect("chilled");

      const waterResult = SkillHits.run(this, "wave", { user, target, context });

      if (
        effectConnected(waterResult, "chilled") &&
        !wasChilledOnImpact &&
        target.alive
      ) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      if (!target.alive) return [waterResult];

      const iceResult = SkillHits.run(this, "frost", { user, target, context });

      if (effectConnected(iceResult, "frozen") && wasChilledOnImpact) {
        target.applyStatusEffect("frozen", this.freezeDuration, context);
      }

      return [waterResult, iceResult];
    },
  },
];

export default sabrinaSkills;
