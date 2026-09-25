import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { hitChance, stillnessBonus } from "./passive.js";

const weyneSkills = [
  {
    ...basicShot,

    bf: 50,
    bonusDamage: 25,

    element: "ice",
    hitVfx: "cryo_round",
    contact: false,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Weyne rides the crosshair down onto the chosen target and lets the cryogenic round go, and the barrel sheds a skin of frost as it leaves. The only shot in her kit that can miss, and the only one worth the risk. Deals physical damage, plus <b>${this.bonusDamage}</b> bonus damage.`,
        pt: `Weyne desce a mira até o alvo escolhido e solta o projétil criogênico, e o cano solta uma camada de gelo ao disparar. O único tiro do seu kit que pode errar, e o único que vale o risco. Causa dano físico, mais <b>${this.bonusDamage}</b> de dano bônus.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const zeroed = user.runtime?.weyneZeroed;
      if (zeroed) user.runtime.weyneZeroed = false;

      if (!zeroed && Math.random() * 100 >= hitChance(user)) {
        const failMessage = `${formatChampionName(user)} breaks her breath a fraction early and the round goes wide of ${formatChampionName(enemy)}.`;

        context.registerDialog?.({
          message: failMessage,
          sourceId: user.id,
          targetId: enemy.id,
        });

        return { log: failMessage };
      }

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: this.bonusDamage + stillnessBonus(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: zeroed ? { force: true } : undefined,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "cold_zero",
    name: "Cold Zero",

    priority: 2,
    targetSpec: ["self"],

    description() {
      return {
        en: `Weyne stops being a person for a turn and becomes a measurement: windage, drop, the cold in her own hands. She does nothing else, and her next <b>Basic Shot</b> cannot miss and is always a <b>critical hit</b>.`,
        pt: `Weyne deixa de ser uma pessoa por um turno e vira uma medição: vento, queda, o frio nas próprias mãos. Ela não faz mais nada, e seu próximo <b>Tiro Básico</b> não pode errar e é sempre um <b>acerto crítico</b>.`,
      };
    },

    resolve({ user, context = {} }) {
      user.runtime ??= {};
      user.runtime.weyneZeroed = true;

      const message = `${formatChampionName(user)} takes her <b>Cold Zero</b> — the next round is already on its way.`;

      context.registerDialog?.({
        message,
        sourceId: user.id,
        targetId: user.id,
      });

      return { log: message };
    },
  },

  {
    key: "suppression_round",
    name: "Suppression Round",

    bf: 35,
    snareDuration: 1,
    chillDuration: 2,

    element: "ice",
    hitVfx: "cryo_round",
    contact: false,
    cannotBeEvaded: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `She does not aim at the chosen target so much as at the ground they were about to stand on, and the frozen core of the barrel puts a wall of cold there instead. The round never misses. Deals physical damage, applies <b>Snared</b> for <b>${this.snareDuration}</b> turn(s) and <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s).`,
        pt: `Ela não mira tanto no alvo escolhido quanto no chão onde ele estava prestes a pisar, e o núcleo congelado do cano põe uma parede de frio ali no lugar. O projétil nunca erra. Causa dano físico, aplica <b>Enredado</b> por <b>${this.snareDuration}</b> turno(s) e <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: stillnessBonus(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      if (effectConnected(results[0], "chilled")) {
        enemy.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return results;
    },
  },

  {
    key: "terminal_ballistics",
    name: "Terminal Ballistics",

    bf: 80,
    piercingPercentage: 95,
    chillDuration: 2,

    element: "ice",
    hitVfx: "cryo_round_big",
    contact: false,
    cannotBeEvaded: true,
    damageMode: "piercing",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Weyne has been holding this one since before the chosen target walked into the street, and the whole winter is in the barrel when she finally lets it go. The round <b>cannot be evaded</b> and ignores <b>${this.piercingPercentage}%</b> of their <b>Defense</b>. Deals physical damage and leaves them <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s).`,
        pt: `Weyne segura esse tiro desde antes do alvo escolhido entrar naquela rua, e o inverno inteiro está no cano quando ela finalmente o solta. O projétil <b>não pode ser esquivado</b> e ignora <b>${this.piercingPercentage}%</b> da <b>Defesa</b> do alvo. Causa dano físico e deixa-o <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: stillnessBonus(user),
        mode: "piercing",
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "chilled")) {
        enemy.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return results;
    },
  },
];

export default weyneSkills;
