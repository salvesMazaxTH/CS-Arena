import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import flashpoint from "./passive.js";

const STORED_HEAT_RUNTIME_FLAG = "victoriaStoredHeat";

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

  context.registerDialog({
    message: `${formatChampionName(owner)} lets the aegis go, and everything it swallowed comes back out.`,
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
    bf: 30,
    bonusDamage: 20,
    description() {
      return {
        en: `Victoria steps in and lets her fist answer, the air curling away from it. Deals physical damage to the chosen target plus <b>${this.bonusDamage}</b> bonus damage, and no taunt can pull the blow aside.`,
        pt: `Victoria avança e deixa o punho responder, o ar se contorcendo ao redor dele. Causa dano físico ao alvo escolhido, mais <b>${this.bonusDamage}</b> de dano bônus, e nenhuma provocação consegue desviar o golpe.`,
      };
    },
  },

  {
    key: "ember_brand",
    name: "Ember Brand",
    bf: 55,
    contact: true,
    element: "fire",
    damageMode: "standard",
    priority: 0,
    ignoresTaunt: true,
    burnDuration: 2,
    brandDuration: 2,

    description() {
      return {
        en:`Victoria drags a burning knuckle across the chosen target, dealing physical damage. If they are not Burning yet, the ember catches and leaves them Burning for <b>${this.burnDuration}</b> turn(s); if they already burn, the fire digs in instead and her next hit on them pierces <b>${flashpoint.brandPiercing}%</b> of their <b>Defense</b>. No taunt can pull the blow aside.`,
        pt: `Victoria arrasta os nós de seus dedos em chamas pelo alvo escolhido, causando dano físico. Se ele não estiver <b>Queimando</b>, a brasa o alcança, deixando-o <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s); se ele já estiver queimando, a chama se aprofunda, e o próximo golpe dela contra esse alvo se torna <b>perfurante</b> (ignorando <b>${flashpoint.brandPiercing}%</b> da <b>Defesa</b>). Nenhuma provocação pode desviar o golpe.`
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

      if (!effectConnected(result, "burning")) {
        return { ...result, targetId: enemy.id };
      }

      if (wasBurning) {
        enemy.runtime.victoriaEmberBrandUntilTurn =
          (context.currentTurn ?? 0) + this.brandDuration;

        return {
          ...result,
          targetId: enemy.id,
          log: `${formatChampionName(enemy)} is branded — the fire on them is waiting for Victoria's next hit.`,
        };
      }

      enemy.applyStatusEffect("burning", this.burnDuration, context, {
        sourceId: user.id,
      });

      return { ...result, targetId: enemy.id };
    },
  },

  {
    key: "phoenix_aegis",
    name: "Phoenix Aegis",
    contact: false,
    element: "fire",
    priority: 2,
    baseShieldRatio: 0.35,
    aegisDuration: 3,
    storedPercent: 40,

    description() {
      return {
        en: `Victoria opens her arms and every ember she has banked closes around her as a pair of burning wings, granting a <b>Shield</b> worth <b>${this.baseShieldRatio * 100}%</b> of her <b>Defense</b> plus all of her stored heat, for <b>${this.aegisDuration}</b> turn(s). While the aegis holds, <b>${this.storedPercent}%</b> of every point of damage aimed at her is banked as heat again, up to <b>${flashpoint.emberHeatCap}</b>. The moment the aegis breaks or burns out, all of that heat is released on every enemy as magical damage that cannot be evaded.`,
        pt: `Victoria abre seus braços e toda brasa que ela acumulou se fecha ao seu redor em um par de asas flamejantes, concedendo um <b>Escudo</b> equivalente a <b>${this.baseShieldRatio * 100}%</b> de sua <b>Defesa</b> mais todo o calor armazenado, por <b>${this.aegisDuration}</b> turno(s). Enquanto o égide se mantém de pé, <b>${this.storedPercent}%</b> de todo ponto de dano mirado contra ela é acumulado como calor novamente, até um máximo de <b>${flashpoint.emberHeatCap}</b>. No momento em que o égide se quebra ou expira, todo aquele calor é liberado em todos os inimigos como dano mágico que não pode ser esquivado.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (effect) => effect.key !== this.key,
      );

      // Raising a second aegis shatters the first one, setting its heat off.
      const stored = hasAegisShield(user)
        ? (releaseStoredHeat(user, context), 0)
        : consumeStoredHeat(user);

      const skill = this;

      user.addShield(
        Math.round(user.Defense * this.baseShieldRatio) + stored,
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
            log: `<b>${skill.name}</b> shatters and burns everything it had been holding.`,
          };
        },

        onTurnStart({ owner, context }) {
          if (hasAegisShield(owner)) return;

          this.expiresAtTurn = context.currentTurn;
          releaseStoredHeat(owner, context);
        },
      };

      user.addHookEffect(effect, context);

      return {
        log: `${formatChampionName(user)} raises the Phoenix Aegis!`,
      };
    },
  },

  {
    key: "solar_fist",
    name: "Solar Fist",
    bf: 95,
    contact: true,
    element: "fire",
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    momentumCost: 55,
    consumeBonus: 70,

    description() {
      return {
        en: `Victoria winds up once and brings down something closer to a small sun than a fist, dealing physical damage to the chosen target. If they are Burning, the fire is swallowed whole and the blow lands with <b>${this.consumeBonus}</b> bonus damage.`,
        pt: `Victoria toma impulso uma única vez e desce algo mais parecido com um pequeno sol do que um punho, causando dano físico ao alvo escolhido. Se ele estiver <b>Queimando</b>, o fogo é engolido por inteiro e o golpe chega com <b>${this.consumeBonus}</b> de dano bônus.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const consumes = enemy.hasStatusEffect("burning");

      if (consumes) {
        enemy.removeStatusEffect("burning");
      }

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

      return {
        ...result,
        targetId: enemy.id,
        log: consumes
          ? `Victoria tears the fire off ${formatChampionName(enemy)} and drives it back into them!`
          : undefined,
      };
    },
  },
];

export default victoriaSkills;
