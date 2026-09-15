// Centralized Basic Shot (global ranged)
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

const basicShot = {
  key: "basic_shot",
  name: "Basic Shot",
  bf: 20,
  bonusDamage: 15,
  contact: false,
  damageMode: "standard",
  priority: 0,
  description() {
    return `\n A plain ranged shot, carrying ${this.bonusDamage} bonus damage on top. Physical or magical, depending on the champion.`;
  },
  targetSpec: ["enemy"],
  resolve({ user, targets, context = {} }) {
    const [enemy] = targets;
    // Per-champion override: { ...basicShot, type: "..." }
    const type = this.type || "physical";
    return new DamageEvent({
      baseDamage: (user.Attack * this.bf) / 100,
      bonusDamage: this.bonusDamage,
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
