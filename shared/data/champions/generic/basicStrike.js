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
    return `\n A plain physical blow, carrying ${this.bonusDamage} bonus damage on top.`;
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
