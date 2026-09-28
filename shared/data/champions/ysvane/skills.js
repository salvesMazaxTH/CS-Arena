import { regularShieldTotal } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import basicShot from "../generic/basicShot.js";
import { KEPT_KEY } from "./passive.js";

const wardOfTheKeep = {
  key: "ward_of_the_keep",
  name: "Ward of the Keep",

  keptDuration: 2,
  dmgReductionPercent: 10,
  shieldAmount: 30,
  shieldDecay: 15,
  shieldCap: 120,

  contact: false,
  priority: 2,
  element: "ice",

  description() {
    return {
      en: `Ysvane sets the chosen ally inside the Keep, where nothing is permitted to spoil, under a <b>${this.shieldAmount}</b> <b>Shield</b>. They are <b>Kept</b> for <b>${this.keptDuration}</b> turn(s), or until Ysvane leaves the field: they carry <b>Affliction Ward</b> — the first negative effect that would take hold never does — and take <b>${this.dmgReductionPercent}%</b> less damage.

      Nothing left untouched in the Keep stays the size it was: while they are <b>Kept</b>, that <b>Shield</b> does not thin, and it doubles at the start of every turn they came through without being hit at all, up to <b>${this.shieldCap}</b>. Once the Keep lets go, everything it held goes with it, and the <b>Shield</b> thins by <b>${this.shieldDecay}</b> each turn like any other.`,
      pt: `Ysvane coloca a aliada escolhida dentro do Cofre, onde nada tem permissão de estragar, sob um <b>Escudo</b> de <b>${this.shieldAmount}</b>. Ela fica <b>Resguardada</b> por <b>${this.keptDuration}</b> turno(s), ou até Ysvane deixar o campo: carrega <b>Proteção contra Aflição</b> — o primeiro efeito negativo que tentar se firmar simplesmente não acontece — e sofre <b>${this.dmgReductionPercent}%</b> menos dano.

      Nada que fique intocado dentro do Cofre continua do mesmo tamanho: enquanto ela estiver <b>Resguardada</b>, esse <b>Escudo</b> não diminui, e dobra no início de todo turno em que ela não é atingida nem uma vez, até <b>${this.shieldCap}</b>. Quando o Cofre se abre, tudo o que ele guardava vai junto, e o <b>Escudo</b> passa a diminuir <b>${this.shieldDecay}</b> por turno como qualquer outro.`,
    };
  },

  targetSpec: ["select:ally"],

  resolve({ user, targets, context = {} }) {
    const [ally = user] = targets;

    ally.addShield(this.shieldAmount, this.shieldDecay, context, "regular", {
      vaultShield: true,
    });
    this.keep({ user, ally, context });

    const userName = formatChampionName(user);
    const allyName = formatChampionName(ally);

    return {
      log: `${userName} sets ${
        userName === allyName ? "herself" : allyName
      } inside the Keep: Kept, under a ${this.shieldAmount} Shield.`,
    };
  },

  // Kept is one aura: every bonus hangs off this hook and leaves with it.
  keep({ user, ally, context, dmgReductionPercent = this.dmgReductionPercent }) {
    const { keptDuration, shieldCap, shieldDecay } = this;
    const vaultShields = () => ally.runtime.shields.filter((s) => s.vaultShield);

    ally.removeHookEffects((e) => e.key === KEPT_KEY);

    const added = ally.addHookEffect(
      {
        type: "buff",
        key: KEPT_KEY,
        name: "Kept",
        group: "skill",
        ownerId: user.id,
        sustainedById: user.id,
        expiresAtTurn: context.currentTurn + keptDuration,

        hookScope: {
          onAfterDmgTaking: "defender",
        },

        // Any hit at all opens the Keep, a burn tick included.
        hookPolicies: {
          onAfterDmgTaking: {
            allowOnDot: true,
            allowOnNestedDamage: true,
            allowOnAbsolute: true,
          },
        },

        // The Shield eating the blow does not save the turn: what matters is
        // that something reached them at all.
        onAfterDmgTaking({ owner, damage, context }) {
          if (!(damage > 0)) return;
          owner.runtime.vaultShieldSpoiledTurn = context.currentTurn;
        },

        onTurnStart({ owner, context }) {
          const shield = owner.runtime.shields.find((s) => s.vaultShield);
          if (!shield) return;
          if (owner.runtime.vaultShieldSpoiledTurn === context.currentTurn - 1)
            return;
          if (shield.amount >= shieldCap) return;

          shield.amount = Math.min(shield.amount * 2, shieldCap);

          return {
            log: `The Keep has not been opened: ${formatChampionName(owner)}'s Shield doubles to ${shield.amount}.`,
          };
        },

        onRemoved({ owner }) {
          owner.damageReductionModifiers = owner.damageReductionModifiers.filter(
            (m) => m.source !== KEPT_KEY,
          );
          if (owner.getStatusEffect("afflictionWard")?.sourceId === user.id) {
            owner.removeStatusEffect("afflictionWard");
          }
          for (const shield of vaultShields()) shield.decayPerTurn = shieldDecay;
        },
      },
      context,
    );
    if (!added) return;

    ally.applyStatusEffect("afflictionWard", keptDuration, context, {
      sourceId: user.id,
    });
    ally.applyDamageReduction({
      amount: dmgReductionPercent,
      type: "percent",
      source: KEPT_KEY,
      context,
    });
    for (const shield of vaultShields()) shield.decayPerTurn = 0;
  },
};

const ysvaneSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical", hitVfxPalette: "glacial" },

  // ========================
  // Special Abilities
  // ========================

  wardOfTheKeep,

  {
    key: "hold_fast",
    name: "Hold Fast",

    effectDuration: 2,
    damageReductionPercent: 30,

    contact: false,
    priority: 2,
    element: "ice",

    lockedOutStatusKeys: ["stunned", "frozen"],

    description() {
      return {
        en: `Ysvane closes the cold around the chosen ally until they are held at exactly the shape they were. For <b>${this.effectDuration}</b> turn(s) they take <b>${this.damageReductionPercent}%</b> less damage and cannot be <b>Stunned</b> or <b>Frozen</b> — nothing gets a grip on what the Keep is holding.`,
        pt: `Ysvane fecha o frio em torno da aliada escolhida até segurá-la exatamente na forma que estava. Por <b>${this.effectDuration}</b> turno(s) ela sofre <b>${this.damageReductionPercent}%</b> menos dano e não pode ser <b>Atordoada</b> nem <b>Congelada</b> — nada consegue firmar pegada no que o Cofre está segurando.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;
      const key = "hold_fast_stasis";
      const lockedOutStatusKeys = this.lockedOutStatusKeys;

      ally.runtime.hookEffects ??= [];
      ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
        (e) => e.key !== key,
      );

      ally.applyDamageReduction({
        amount: this.damageReductionPercent,
        duration: this.effectDuration,
        type: "percent",
        source: this.key,
        context,
      });

      ally.addHookEffect(
        {
          type: "buff",
          key,
          group: "skill",
          ownerId: user.id,
          expiresAtTurn: context.currentTurn + this.effectDuration,

          hookScope: {
            onStatusEffectIncoming: "target",
          },

          onStatusEffectIncoming({ target, owner, statusEffect }) {
            if (target !== owner) return;
            if (!lockedOutStatusKeys.includes(statusEffect?.key)) return;
            return {
              cancel: true,
              message: `${formatChampionName(owner)} is Held Fast: ${statusEffect.name} finds no grip.`,
            };
          },
        },
        context,
      );

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} holds ${
          userName === allyName ? "herself" : allyName
        } fast: ${this.damageReductionPercent}% less damage and no hold takes.`,
      };
    },
  },

  {
    key: "the_long_winter",
    name: "The Long Winter",

    dmgReductionPercent: 20,
    supremePrice: 60,

    contact: false,
    isUltimate: true,
    momentumCost: 62,
    priority: 4,
    element: "ice",

    description() {
      return {
        en: `Ysvane lets the Keep out all at once and a long winter settles over her whole side of the field. Every ally is stripped of every negative status effect and becomes <b>Kept</b> as by <b>${wardOfTheKeep.name}</b>, but takes <b>${this.dmgReductionPercent}%</b> less damage instead of <b>${wardOfTheKeep.dmgReductionPercent}%</b>.

        An ally who walks into the winter with their Keep still sealed — an <b>Affliction Ward</b> nobody has spent yet, under at least <b>${this.supremePrice}</b> <b>Shield</b> — pays <b>${this.supremePrice}</b> of that <b>Shield</b> and the cold closes over what is left as a <b>Supreme Shield</b>. That one is theirs to keep: it stays when the Keep lets go. Whatever <b>Shield</b> they had above the price stays standing underneath it.`,
        pt: `Ysvane deixa o Cofre se abrir de uma vez e um longo inverno se assenta sobre todo o lado dela do campo. Toda aliada é limpa de todo efeito de status negativo e fica <b>Resguardada</b> como por <b>${wardOfTheKeep.name}</b>, mas sofre <b>${this.dmgReductionPercent}%</b> menos dano em vez de <b>${wardOfTheKeep.dmgReductionPercent}%</b>.

        Uma aliada que entra no inverno com seu Cofre ainda selado — uma <b>Proteção contra Aflição</b> que ninguém gastou, sob pelo menos <b>${this.supremePrice}</b> de <b>Escudo</b> — paga <b>${this.supremePrice}</b> desse <b>Escudo</b> e o frio fecha sobre o que sobra como um <b>Escudo Supremo</b>. Esse é dela: continua quando o Cofre se abre. Qualquer <b>Escudo</b> que ela tivesse acima do preço continua de pé por baixo dele.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);
      const crystallized = [];

      for (const ally of allies) {
        if (
          ally.hasStatusEffect("afflictionWard") &&
          regularShieldTotal(ally) >= this.supremePrice
        ) {
          ally.breakShields(this.supremePrice);
          ally.addShield(1, 0, context, "supreme");
          crystallized.push(ally);

          context.registerDialog({
            message: `The Keep closes over ${formatChampionName(ally)} and does not open again.`,
            sourceId: user.id,
            targetId: ally.id,
          });
        }

        ally
          .getStatusEffects({ type: "debuff" })
          .forEach((se) => ally.removeStatusEffect(se.key));

        wardOfTheKeep.keep({
          user,
          ally,
          context,
          dmgReductionPercent: this.dmgReductionPercent,
        });
      }

      const sealed = crystallized.length
        ? ` The Keep seals over ${crystallized.map(formatChampionName).join(", ")}: Supreme Shield.`
        : "";

      return {
        log: `${formatChampionName(user)} lets the Keep out over the whole team: every ally cleansed and Kept in the long winter.${sealed}`,
      };
    },
  },
];

export default ysvaneSkills;
