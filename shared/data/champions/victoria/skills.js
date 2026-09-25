import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { pushResultLog } from "../../../engine/combat/resultLog.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import flashpoint, { STORED_HEAT_RUNTIME_FLAG } from "./passive.js";

const releaseSkill = {
  key: "phoenix_aegis_release",
  name: "Phoenix Aegis",
  element: "fire",
  contact: false,
};

function hasAegisShield(owner) {
  return (owner.runtime?.shields ?? []).some(
    (shield) => shield?.aegis && (Number(shield.amount) || 0) > 0,
  );
}

function consumeStoredHeat(owner) {
  const stored = Number(owner.runtime?.[STORED_HEAT_RUNTIME_FLAG]) || 0;
  delete owner.runtime[STORED_HEAT_RUNTIME_FLAG];
  return stored;
}

export function releaseStoredHeat(owner, context) {
  const stored = consumeStoredHeat(owner);
  if (stored <= 0) return [];

  const enemies = TargetFilter.candidates(
    "enemy",
    owner,
    context.aliveChampions ?? [],
  );
  if (!enemies.length) return [];

  context.registerDialog?.({
    message: {
      en: `${formatChampionName(owner)} lets the aegis go, and everything it swallowed comes back out.`,
      pt: `${formatChampionName(owner)} solta a égide, e tudo o que ela havia engolido volta à tona.`,
    },
    sourceId: owner.id,
  });

  const results = [];

  for (const enemy of enemies) {
    const result = new DamageEvent({
      baseDamage: stored,
      attacker: owner,
      defender: enemy,
      skill: releaseSkill,
      type: "magical",
      mode: "standard",
      cannotBeEvaded: true,
      context,
      allChampions: context.allChampions,
    }).execute();

    results.push(...(Array.isArray(result) ? result : [result]));
  }

  return results;
}

const victoriaSkills = [
  {
    ...basicStrike,
    element: "fire",
    ignoresTaunt: true,
    hitVfx: "fire_punch",
    bf: 30,
    bonusDamage: 20,
    description() {
      return {
        en: `Victoria steps in and lets her fist answer, the air curling away from it. Deals <b>${this.bonusDamage}</b> bonus damage to the chosen target, and no <b>Taunt</b> can pull the blow aside. Deals physical damage.`,
        pt: `Victoria avança e deixa o punho responder, o ar se contorcendo ao redor dele. Causa <b>${this.bonusDamage}</b> de dano bônus ao alvo escolhido, e nenhuma <b>Provocação</b> consegue desviar o golpe. Causa dano físico.`,
      };
    },
  },

  {
    key: "ember_brand",
    name: "Ember Brand",
    bf: 55,
    contact: true,
    element: "fire",
    hitVfx: "fire_punch",
    damageMode: "standard",
    priority: 0,
    ignoresTaunt: true,
    burnDuration: 2,
    brandDuration: 2,

    description() {
      return {
        en: `Victoria drags a burning knuckle across the chosen target. If they are not <b>Burning</b> yet, the ember catches and leaves them <b>Burning</b> for <b>${this.burnDuration}</b> turn(s); if they already burn, the fire digs in instead and her next hit on them pierces <b>${flashpoint.brandPiercing}%</b> of their <b>Defense</b>. No <b>Taunt</b> can pull the blow aside. Deals physical damage.`,
        pt: `Victoria arrasta os nós de seus dedos em chamas pelo alvo escolhido. Se ele não estiver <b>Queimando</b>, a brasa o alcança, deixando-o <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s); se ele já estiver queimando, a chama se aprofunda, e o próximo golpe dela contra esse alvo se torna <b>perfurante</b> (ignorando <b>${flashpoint.brandPiercing}%</b> da <b>Defesa</b>). Nenhuma <b>Provocação</b> pode desviar o golpe. Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const wasBurning = enemy.hasStatusEffect("burning");
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (!results[0]?.landed) return results;

      if (wasBurning) {
        enemy.runtime.victoriaEmberBrandUntilTurn =
          (context.currentTurn ?? 0) + this.brandDuration;

        pushResultLog(results[0], {
          en: `${formatChampionName(enemy)} is branded — the fire on them is waiting for ${formatChampionName(user)}'s next hit.`,
          pt: `${formatChampionName(enemy)} é marcado — o fogo nele espera pelo próximo golpe de ${formatChampionName(user)}.`,
        });

        return results;
      }

      if (effectConnected(results[0], "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "phoenix_aegis",
    name: "Phoenix Aegis",
    contact: false,
    element: "fire",
    priority: 2,
    baseShieldPercent: 35,
    aegisDuration: 3,
    storedPercent: 40,

    description() {
      return {
        en: `Victoria opens her arms and every ember she has banked closes around her as a pair of burning wings, granting a <b>Shield</b> worth <b>${this.baseShieldPercent}%</b> of her <b>Defense</b> plus all of her stored heat, for <b>${this.aegisDuration}</b> turn(s). While the aegis holds, <b>${this.storedPercent}%</b> of every point of damage aimed at her is banked as heat again, up to <b>${flashpoint.emberHeatCap}</b>. The moment the aegis breaks or burns out, all of that heat is released on every enemy as magical damage that cannot be evaded.`,
        pt: `Victoria abre seus braços e toda brasa que ela acumulou se fecha ao seu redor em um par de asas flamejantes, concedendo um <b>Escudo</b> equivalente a <b>${this.baseShieldPercent}%</b> de sua <b>Defesa</b> mais todo o calor armazenado, por <b>${this.aegisDuration}</b> turno(s). Enquanto a égide se mantém de pé, <b>${this.storedPercent}%</b> de todo ponto de dano mirado contra ela é acumulado como calor novamente, até um máximo de <b>${flashpoint.emberHeatCap}</b>. No momento em que a égide se quebra ou expira, todo aquele calor é liberado em todos os inimigos como dano mágico que não pode ser esquivado.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (effect) => effect.key !== this.key,
      );

      // Raising a second aegis shatters the first one, setting its heat off.
      const recast = hasAegisShield(user);
      if (recast) {
        user.runtime.shields = user.runtime.shields.filter((shield) => !shield?.aegis);
      }
      const stored = recast
        ? (releaseStoredHeat(user, context), 0)
        : consumeStoredHeat(user);

      const skill = this;

      user.addShield(
        Math.round((user.Defense * this.baseShieldPercent) / 100) + stored,
        0,
        context,
        "regular",
        {
          visualVariant: "fire",
          aegis: true,
          expiresAtTurn: context.currentTurn + this.aegisDuration,
        },
      );

      const effect = {
        type: "buff",
        key: this.key,
        group: "skill",
        ownerId: user.id,

        hookScope: { onAfterDmgTaking: "defender" },
        hookPolicies: {
          onAfterDmgTaking: {
            allowOnDot: true,
            allowOnNestedDamage: true,
            allowOnAbsolute: true,
          },
        },

        onAfterDmgTaking({ owner, defender, damage, context }) {
          if (defender !== owner) return;

          if (damage > 0) {
            const heat = Number(owner.runtime[STORED_HEAT_RUNTIME_FLAG]) || 0;
            owner.runtime[STORED_HEAT_RUNTIME_FLAG] = Math.min(
              flashpoint.emberHeatCap,
              heat + Math.round((Number(damage) * skill.storedPercent) / 100),
            );
          }

          if (hasAegisShield(owner)) return;

          this.expiresAtTurn = context.currentTurn;
          releaseStoredHeat(owner, context);

          return {
            log: {
              en: `<b>${skill.name}</b> shatters and burns everything it had been holding.`,
              pt: `<b>${skill.name}</b> se despedaça e queima tudo o que tinha acumulado.`,
            },
          };
        },

        onTurnStart({ owner, context }) {
          if (hasAegisShield(owner)) return;

          this.expiresAtTurn = context.currentTurn;
          releaseStoredHeat(owner, context);

          return {
            log: {
              en: `<b>${skill.name}</b> burns out and lets go of everything it had been holding.`,
              pt: `<b>${skill.name}</b> se apaga e solta tudo o que tinha acumulado.`,
            },
          };
        },
      };

      user.addHookEffect(effect, context);

      return {
        log: {
          en: `${formatChampionName(user)} raises the <b>${this.name}</b>!`,
          pt: `${formatChampionName(user)} ergue a <b>Égide da Fênix</b>!`,
        },
      };
    },
  },

  {
    key: "solar_fist",
    name: "Solar Fist",
    bf: 95,
    contact: true,
    element: "fire",
    hitVfx: "fire_punch",
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    momentumCost: 55,
    consumeBonus: 70,

    description() {
      return {
        en: `Victoria winds up once and brings down something closer to a small sun than a fist on the chosen target. If they are <b>Burning</b>, the fire is swallowed whole and the blow lands with <b>${this.consumeBonus}</b> bonus damage. Deals physical damage.`,
        pt: `Victoria toma impulso uma única vez e desce algo mais parecido com um pequeno sol do que um punho sobre o alvo escolhido. Se ele estiver <b>Queimando</b>, o fogo é engolido por inteiro e o golpe chega com <b>${this.consumeBonus}</b> de dano bônus. Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const consumes = enemy.hasStatusEffect("burning");

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: consumes ? this.consumeBonus : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (consumes && results[0]?.landed) {
        enemy.removeStatusEffect("burning");

        pushResultLog(results[0], {
          en: `${formatChampionName(user)} tears the fire off ${formatChampionName(enemy)} and drives it back into them!`,
          pt: `${formatChampionName(user)} arranca o fogo de ${formatChampionName(enemy)} e o crava de volta nele!`,
        });
      }

      return results;
    },
  },
];

export default victoriaSkills;
