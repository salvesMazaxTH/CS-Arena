import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";

const yresaPetronikaSkills = [
  { ...basicShot, type: "magical", bonusDamage: 20 },

  {
    key: "claiming_roots",
    name: "Claiming Roots",

    bf: 70,
    damageMode: "standard",
    element: "earth",
    rootDuration: 2,

    contact: false,
    hitVfx: "roots",
    priority: 0,

    description() {
      return {
        en: `Yrêsa Petroníka claims the ground beneath the chosen target as her own, dealing <b>Earth</b> magical damage and holding them <b>Rooted</b> for <b>${this.rootDuration}</b> turn(s).`,
        pt: `Yrêsa Petroníka reivindica como seu o chão sob o alvo escolhido, causando dano mágico de <b>Terra</b> e mantendo-o <b>Enraizado</b> por <b>${this.rootDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "rooted")) {
        enemy.applyStatusEffect("rooted", this.rootDuration, context);
      }

      return result;
    },
  },

  {
    key: "rootwards_shape",
    name: "Rootward's Shape",

    dmgReductionPercent: 30,
    colossusDmgReductionPercent: 45,
    dmgReductionDuration: 3,
    dmgReductionSrc: "yresa_petronika_rootwards_shape",

    contact: false,
    priority: 0,

    description() {
      return {
        en: `Targeting herself, Yrêsa Petroníka raises another <b>Rootward</b> out of the ground, a sentinel of packed earth and ore that stands on the field beside her. Targeting any other ally, she unmakes one of her standing Rootwards and pours it over them, leaving them with <b>${this.dmgReductionPercent}%</b> less damage taken for <b>${this.dmgReductionDuration}</b> turn(s) (except Absolute Damage). With no Rootward standing but a <b>Rootward Colossus</b> on the field, she takes the Colossus apart instead, for <b>${this.colossusDmgReductionPercent}%</b> less damage taken over the same duration. With nothing standing at all, she always raises one.`,
        pt: `Ao mirar em si mesma, Yrêsa Petroníka ergue mais um <b>Rootward</b> do chão, uma sentinela de terra compacta e minério que passa a ocupar o campo ao lado dela. Ao mirar em qualquer outro aliado, ela desfaz um de seus Rootwards de pé e o derrama sobre ele, deixando-o com <b>${this.dmgReductionPercent}%</b> menos dano sofrido por <b>${this.dmgReductionDuration}</b> turno(s) (exceto Dano Absoluto). Sem nenhum Rootward de pé, mas com um <b>Rootward Colossus</b> no campo, ela desfaz o Colossus no lugar, para <b>${this.colossusDmgReductionPercent}%</b> menos dano sofrido pela mesma duração. Sem nada de pé, ela sempre ergue um.`,
      };
    },

    targetSpec: [{ type: "select:ally", entityType: "champion" }],

    resolve({ user, targets, context = {} }) {
      const ally = targets[0];
      const sentinelIds = user.passive.livingSentinels({ owner: user, context });
      const colossus = user.passive.livingColossus({ owner: user, context });

      if (ally.id === user.id) return this._raise({ user, context });

      if (sentinelIds.length > 0) {
        return this._unmake({
          user,
          rootward: this._spentFirst({ sentinelIds, context }),
          ally,
          amount: this.dmgReductionPercent,
          context,
        });
      }

      if (colossus) {
        return this._unmake({
          user,
          rootward: colossus,
          ally,
          amount: this.colossusDmgReductionPercent,
          context,
        });
      }

      return this._raise({ user, context });
    },

    _spentFirst({ sentinelIds, context }) {
      return sentinelIds
        .map((id) => context.allChampions.get(id))
        .reduce((spent, rootward) =>
          rootward.HP < spent.HP ? rootward : spent,
        );
    },

    _raise({ user, context }) {
      context.schedule({
        type: "spawnChampion",
        turnToHappen: context.currentTurn + 1,
        payload: {
          championKey: "yresa_sentinel",
          team: user.team,
          asEntityType: "minion",

          onSpawn: (sentinel, spawnContext) => {
            sentinel.runtime.summonerId = user.id;
            sentinel.runtime.leavesNoDeath = true;

            user.runtime.sentinelIds = [
              ...(user.runtime.sentinelIds ?? []),
              sentinel.id,
            ];

            sentinel.applyStatusEffect("inert", 99, spawnContext);
            sentinel.passive.refreshAura({ owner: sentinel, context: spawnContext });
            user.passive.refreshSoil({ owner: user, context: spawnContext });

            spawnContext.registerDialog?.({
              message: {
                en: `${formatChampionName(user)} calls Rootward up from the ground to guard her.`,
                pt: `${formatChampionName(user)} chama Rootward para fora do chão para guardá-la.`,
              },
              sourceId: user.id,
              targetId: sentinel.id,
            });
          },
        },
      });

      return {
        log: {
          en: `${formatChampionName(user)} pulls <b>Rootward</b> out of the soil.`,
          pt: `${formatChampionName(user)} puxa <b>Rootward</b> para fora da terra.`,
        },
      };
    },

    _unmake({ user, rootward, ally, amount, context }) {
      rootward.passive.clearAura({ owner: rootward, context });

      rootward.HP = 0;
      rootward.alive = false;

      user.runtime.sentinelIds = (user.runtime.sentinelIds ?? []).filter(
        (id) => id !== rootward.id,
      );
      if (user.runtime.colossusId === rootward.id) user.runtime.colossusId = null;
      user.passive.refreshSoil({ owner: user, context });

      ally.damageReductionModifiers = (
        ally.damageReductionModifiers ?? []
      ).filter((modifier) => modifier?.source !== this.dmgReductionSrc);

      ally.applyDamageReduction({
        amount,
        duration: this.dmgReductionDuration,
        type: "percent",
        source: this.dmgReductionSrc,
        context,
      });

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(user)} takes ${formatChampionName(rootward)} apart and lays it over ${formatChampionName(ally)}.`,
          pt: `${formatChampionName(user)} desmonta ${formatChampionName(rootward)} e o assenta sobre ${formatChampionName(ally)}.`,
        },
        sourceId: user.id,
        targetId: ally.id,
      });

      return {
        log: {
          en: `${formatChampionName(rootward)} is unmade; its earth now shields ${formatChampionName(ally)}.`,
          pt: `${formatChampionName(rootward)} é desfeito; sua terra agora protege ${formatChampionName(ally)}.`,
        },
      };
    },
  },

  {
    key: "become_the_mountain",
    name: "Become the Mountain",

    bf: 90,

    contact: false,
    damageMode: "standard",
    element: "earth",
    isUltimate: true,
    momentumCost: 50,
    priority: 0,

    transformInto: "yresa_petronika_primordial",
    transformDuration: 3,

    fusionMinimum: 2,
    colossusKey: "yresa_colossus",
    colossusBaseStats: { HP: 50, Attack: 50, Defense: 80, Speed: 10 },
    colossusStatsPerRootward: { HP: 60, Attack: 10, Defense: 20, Speed: 5 },

    description() {
      return {
        en: `Yrêsa Petroníka lets go of the shape she wears and becomes the ground itself. She strikes the chosen target once, then unfolds into the earth and ore she ruled before it had a name — her <b>Primordial Form</b> — for <b>${this.transformDuration}</b> turn(s), replacing her skills, her passive and her stats. If <b>${this.fusionMinimum}</b> or more <b>Rootwards</b> stand when she unfolds, they collapse into one another and rise as the <b>Rootward Colossus</b>, a golem that grows with every Rootward poured into it and stays on the field after she returns. Deals magical damage.`,
        pt: `Yrêsa Petroníka abre mão da forma que veste e se torna o próprio chão. Ela golpeia o alvo escolhido uma vez e então se desdobra na terra e no minério que governava antes de isso ter nome — sua <b>Forma Primordial</b> — por <b>${this.transformDuration}</b> turno(s), substituindo suas skills, sua passiva e seus atributos. Se <b>${this.fusionMinimum}</b> ou mais <b>Rootwards</b> estiverem de pé quando ela se desdobrar, eles desabam uns sobre os outros e se erguem como o <b>Rootward Colossus</b>, um golem que cresce a cada Rootward derramado nele e que permanece no campo depois que ela volta. Causa dano mágico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];

      context.requestChampionMutation({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.transformDuration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      const fusionLog = this._fuse({ user, context });
      if (fusionLog) results.push(fusionLog);

      results.push({
        log: {
          en: `${formatChampionName(user)} lets go of her worn shape and unfolds into the earth itself for ${this.transformDuration} turn(s)!`,
          pt: `${formatChampionName(user)} abre mão da forma que vestia e se desdobra na própria terra por ${this.transformDuration} turno(s)!`,
        },
      });

      return results;
    },

    _fuse({ user, context }) {
      const sentinelIds = user.passive.livingSentinels({ owner: user, context });
      if (sentinelIds.length < this.fusionMinimum) return null;

      const fused = sentinelIds.length;

      for (const id of sentinelIds) {
        const rootward = context.allChampions.get(id);
        rootward.passive.clearAura({ owner: rootward, context });
        rootward.HP = 0;
        rootward.alive = false;
      }

      user.runtime.sentinelIds = [];
      user.passive.refreshSoil({ owner: user, context });

      context.schedule({
        type: "spawnChampion",
        turnToHappen: context.currentTurn + 1,
        payload: {
          championKey: this.colossusKey,
          team: user.team,
          asEntityType: "minion",
          statScaleByStat: this._colossusScale(fused),

          onSpawn: (colossus, spawnContext) => {
            colossus.runtime.summonerId = user.id;
            colossus.runtime.leavesNoDeath = true;
            colossus.runtime.fusedRootwards = fused;
            user.runtime.colossusId = colossus.id;

            colossus.passive.refreshAura({ owner: colossus, context: spawnContext });

            spawnContext.registerDialog?.({
              message: {
                en: `The Rootwards fall into one another and stand back up as the <b>Rootward Colossus</b>.`,
                pt: `Os Rootwards desabam uns sobre os outros e se levantam como o <b>Rootward Colossus</b>.`,
              },
              sourceId: user.id,
              targetId: colossus.id,
            });
          },
        },
      });

      return {
        log: {
          en: `<b>${fused}</b> Rootwards collapse into one another at ${formatChampionName(user)}'s feet.`,
          pt: `<b>${fused}</b> Rootwards desabam uns sobre os outros aos pés de ${formatChampionName(user)}.`,
        },
      };
    },

    _colossusScale(fused) {
      const scale = {};

      for (const [stat, base] of Object.entries(this.colossusBaseStats)) {
        scale[stat] = (base + this.colossusStatsPerRootward[stat] * fused) / base;
      }

      return scale;
    },
  },
];

export default yresaPetronikaSkills;
