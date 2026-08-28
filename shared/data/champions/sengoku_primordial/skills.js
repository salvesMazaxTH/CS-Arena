import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const sengokuPrimordialSkills = [
  totalBlock,
  {
    key: "primordial_talon",
    name: "Primordial Talon",
    bf: 95,
    damageMode: "standard",
    hitVfx: "slash",
    contact: true,
    priority: 0,
    description() {
      return `Sengoku tears through the chosen target with draconic talons older than the war itself, dealing heavy physical damage.`;
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
    key: "cataclysmic_breath",
    name: "Cataclysmic Breath",
    bf: 130,
    damageMode: "standard",
    element: "fire",
    contact: false,
    isUltimate: true,
    momentumCost: 33,
    priority: 0,
    description() {
      return `Sengoku draws breath and pours primordial fire across the field, dealing magical damage to all enemies.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      return enemies.map((enemy) => {
        const baseDamage = (user.Attack * this.bf) / 100;
        return new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
      });
    },
  },
];

export default sengokuPrimordialSkills;
