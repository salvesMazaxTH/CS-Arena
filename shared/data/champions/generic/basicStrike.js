// Centralized Basic Strike (global melee)
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

const basicStrike = {
  key: "basic_strike",
  name: "Basic Strike",
  bf: 20,
  bonusFlat: 20,
  contact: true,
  damageMode: "standard",
  priority: 0,
  description() {
    return `\n A plain physical blow that makes contact (BF ${this.bf} + ${this.bonusFlat} flat bonus).`;
  },
  targetSpec: ["enemy"],
  resolve({ user, targets, context = {} }) {
    const [enemy] = targets;
    const baseDamage = (user.Attack * this.bf) / 100 + this.bonusFlat;
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
};

export default basicStrike;
