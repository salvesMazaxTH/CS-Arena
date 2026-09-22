import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const maliMagarcPrimordialSkills = [
  totalBlock,

  {
    key: "unaimed_discharge",
    name: "Unaimed Discharge",

    bf: 22,

    contact: false,
    damageMode: "absolute",
    hitVfx: "arcane_bolt",
    priority: 0,

    description() {
      return {
        en: `Mali Magarc stops choosing where the power lands and simply becomes its release. Deals <b>Absolute Damage</b> to <b>ALL</b> enemies.`,
        pt: `Mali Magarc para de escolher onde o poder cai e simplesmente se torna sua liberação. Causa <b>dano Absoluto</b> a <b>TODOS</b> os inimigos.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive) continue;

        const result = new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          mode: DamageEvent.Modes.ABSOLUTE,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(result) ? result : [result]));
      }

      return results;
    },
  },

  {
    key: "first_magic_undivided",
    name: "The First Magic, Undivided",

    bf: 63,

    contact: false,
    damageMode: "absolute",
    hitVfx: "arcane_bolt_big",
    isUltimate: true,
    momentumCost: 27,
    priority: 0,

    description() {
      return {
        en: `Mali Magarc gathers the whole of the first magic into one undivided strike on the chosen target. Deals devastating <b>Absolute Damage</b>.`,
        pt: `Mali Magarc reúne toda a primeira magia em um único golpe indivisível contra o alvo escolhido. Causa devastador <b>dano Absoluto</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        mode: DamageEvent.Modes.ABSOLUTE,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default maliMagarcPrimordialSkills;
