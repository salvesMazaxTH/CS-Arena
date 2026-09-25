import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const helyraSkills = [
  // =========================
  // Total Block (global)
  // =========================

  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "twin_report",
    name: "Twin Report",

    bf: 75,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfx: "charged_round",
    priority: 1,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Helyra crosses both muzzles on the chosen target without breaking stride, and the marble hall gives back one flat crack instead of two. Deals physical damage.`,
        pt: `Helyra cruza os dois canos sobre o alvo escolhido sem sequer quebrar o passo, e o salão de mármore devolve um único estampido seco, em vez de dois. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
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
    key: "live_round",
    name: "Live Round",

    bf: 65,
    conductorDuration: 2,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfx: "charged_round",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Helyra buries a round that never finishes discharging, and from that moment the chosen target is less a person than a path to ground: they are left <b>Conductor</b> for <b>${this.conductorDuration}</b> turn(s). Deals physical damage.`,
        pt: `Helyra enterra no alvo um projétil que jamais termina de descarregar e, a partir desse instante, o alvo escolhido deixa de ser alguém e passa a ser apenas um caminho até o chão, ficando <b>Condutor</b> por <b>${this.conductorDuration}</b> turno(s). Causa dano físico.`,
      };
    },

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const resultArray = Array.isArray(result) ? result : [result];

      if (effectConnected(resultArray[0], "conductor")) {
        enemy.applyStatusEffect("conductor", this.conductorDuration, context, {
          sourceId: user.id,
        });
      }

      return resultArray;
    },
  },

  {
    key: "shatterline",
    name: "Shatterline",

    bf: 125,
    conductorArcPercent: 60,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfx: "charged_round_big",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Helyra runs the whole length of the hall with both guns open, and every pane and plinth between her and the chosen target comes apart in her wake. The current of this round goes looking for ground: every other <b>Conductor</b> enemy it reaches takes <b>${this.conductorArcPercent}%</b> of the damage dealt as <b>Absolute Damage</b> instead of the usual share, and every enemy it passes through loses <b>Conductor</b>. Deals physical damage.`,
        pt: `Helyra atravessa o salão de uma ponta à outra, com as duas armas em punho, e cada vitral e cada pedestal entre ela e o alvo escolhido se desfaz por onde passa. A corrente dessa bala procura o chão: cada outro inimigo <b>Condutor</b> que ela alcança recebe <b>${this.conductorArcPercent}%</b> do dano causado como <b>Dano Absoluto</b>, no lugar da parcela de sempre, e todo inimigo por onde ela passa perde o <b>Condutor</b>. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default helyraSkills;
