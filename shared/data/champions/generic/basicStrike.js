// Centralized Basic Strike (global melee)
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

const basicStrike = {
  key: "basic_strike",
  name: "Basic Strike",
  bf: 20,
  bonusDamage: 15,
  contact: true,
  damageMode: "standard",
  priority: 0,
  description() {
    return {
      en: `A plain physical blow, carrying <b>${this.bonusDamage}</b> bonus damage on top. Deals physical damage.`,
      pt: `Um golpe físico direto, que carrega <b>${this.bonusDamage}</b> de dano bônus. Causa dano físico.`,
    };
  },
  targetSpec: ["enemy"],
  resolve({ user, targets, context = {} }) {
    const [enemy] = targets;
    return new DamageEvent({
      baseDamage: (user.Attack * this.bf) / 100,
      bonusDamage: this.bonusDamage,
      attacker: user,
      defender: enemy,
      skill: this,
      type: "physical",
      context,
      allChampions: context?.allChampions,
    }).execute();
  },
};

export default basicStrike;
