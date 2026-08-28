// Centralized Basic Shot (global ranged)
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

const basicShot = {
  key: "basic_shot",
  name: "Basic Shot",
  bf: 20,
  bonusFlat: 20,
  contact: false,
  damageMode: "standard",
  priority: 0,
  description() {
    return `\n A plain ranged shot (BF ${this.bf} + ${this.bonusFlat} flat bonus). Physical or magical, depending on the champion.`;
  },
  targetSpec: ["enemy"],
  resolve({ user, targets, context = {} }) {
    const [enemy] = targets;
    const baseDamage = (user.Attack * this.bf) / 100 + this.bonusFlat;
    // Per-champion override: { ...basicShot, type: "..." }
    const type = this.type || "physical";
    return new DamageEvent({
      baseDamage,
      attacker: user,
      defender: enemy,
      skill: this,
      type,
      context,
      allChampions: context?.allChampions,
    }).execute();
  },
};

export default basicShot;
