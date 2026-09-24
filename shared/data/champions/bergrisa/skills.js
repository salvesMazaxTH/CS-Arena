import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import passive from "./passive.js";
import totalBlock from "../generic/totalBlock.js";

function strikeAll(skill, user, targets, context) {
  const baseDamage = (user.Attack * skill.bf) / 100;
  const results = [];

  for (const enemy of targets) {
    const damageResult = new DamageEvent({
      baseDamage,
      attacker: user,
      defender: enemy,
      skill,
      type: "physical",
      context,
      allChampions: context?.allChampions,
    }).execute();

    results.push(
      ...(Array.isArray(damageResult) ? damageResult : [damageResult]),
    );
  }

  return results;
}

const bergrisaSkills = [
  totalBlock,

  {
    key: "valleystride",
    name: "Valleystride",
    bf: 45,
    damageMode: "standard",
    contact: true,
    priority: 0,
    stunDuration: 1,
    stunSedimentCost: 8,
    stunGapThreshold: 110,

    description() {
      return {
        en: `Bergrisa takes one step, and the whole line of them has to decide where it stands. She strikes every enemy at once; if she is holding <b>${this.stunSedimentCost}</b> <b>Sediment</b> she spends it to <b>Stun</b> for <b>${this.stunDuration}</b> turn the enemy whose <b>Defense</b> she most outweighs, and only if that gap is at least <b>${this.stunGapThreshold}</b>. Deals physical damage.`,
        pt: `Bergrisa dá um passo, e toda a linha inimiga precisa decidir onde se firmar. Ela atinge todos os inimigos de uma vez; se estiver com <b>${this.stunSedimentCost}</b> de <b>Sedimento</b>, ela o gasta para <b>Atordoar</b> por <b>${this.stunDuration}</b> turno o inimigo cuja <b>Defesa</b> ela mais supera, e apenas se essa diferença for de pelo menos <b>${this.stunGapThreshold}</b>. Causa dano físico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const results = strikeAll(this, user, targets, context);

      const sediment = user.runtime?.bergrisaSediment || 0;
      if (sediment < this.stunSedimentCost) return results;

      const outweighed = targets
        .filter((enemy) => enemy.alive)
        .sort((a, b) => (a.Defense || 0) - (b.Defense || 0))[0];

      if (!outweighed) return results;

      const gap = (user.Defense || 0) - (outweighed.Defense || 0);
      if (gap < this.stunGapThreshold) return results;

      const hit = results.find((r) => r?.defender?.id === outweighed.id);
      if (!effectConnected(hit, "stunned")) return results;

      passive.setSediment(user, sediment - this.stunSedimentCost, context);

      outweighed.applyStatusEffect("stunned", this.stunDuration, context, {
        sourceId: user.id,
      });

      results.push({
        log: {
          en: `<b>[${this.name}]</b> ${formatChampionName(user)} spent ${this.stunSedimentCost} Sediment and pinned ${formatChampionName(outweighed)} to the ground.`,
          pt: `<b>[${this.name}]</b> ${formatChampionName(user)} gastou ${this.stunSedimentCost} de Sedimento e cravou ${formatChampionName(outweighed)} no chão.`,
        },
      });

      return results;
    },
  },

  {
    key: "under_the_palm",
    name: "Under the Palm",
    contact: false,
    priority: 3,
    tauntDuration: 1,

    description() {
      return {
        en: `Bergrisa lowers an open hand over one enemy and the valley leans with her. The chosen target is <b>Taunted</b> for <b>${this.tauntDuration}</b> turn, and until her next turn every blow her other allies take is blunted by exactly what <b>Strata</b> blunts from hers at the moment she casts this, a value that stays fixed even as her <b>Sediment</b> changes, except <b>Absolute Damage</b>, damage over time and piercing hits.`,
        pt: `Bergrisa abaixa uma mão aberta sobre um inimigo e o vale se inclina com ela. O alvo escolhido fica <b>Provocado</b> por <b>${this.tauntDuration}</b> turno, e até o próximo turno dela todo golpe que os demais aliados sofrerem é amortecido exatamente no quanto <b>Strata</b> amortece os dela no momento em que ela usa esta habilidade, exceto <b>Dano Absoluto</b>, dano ao longo do tempo e acertos perfurantes.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const logs = [];

      const tauntLog = target.applyTaunt(user.id, this.tauntDuration, context);
      if (tauntLog) logs.push(tauntLog);

      const subtraction = passive.subtractionFor(user);
      const expiresAtTurn = (context.currentTurn || 0) + 1;
      const allies = TargetFilter.candidates(
        "ally",
        user,
        context.aliveChampions ?? [],
      ).filter((ally) => ally !== user);

      for (const ally of allies) {
        ally.addHookEffect(
          {
            type: "buff",
            key: "under_the_palm",
            name: "Under the Palm",
            expiresAtTurn,
            hookScope: { onBeforeDmgTaking: "defender" },
            onBeforeDmgTaking(payload) {
              const damage = passive.bluntHit(payload, subtraction);
              if (damage === undefined) return;

              return { damage };
            },
          },
          context,
        );
      }

      logs.push({
        log: {
          en: `<b>[${this.name}]</b> ${formatChampionName(user)} set her hand over the field; every other ally now subtracts ${subtraction} from each blow.`,
          pt: `<b>[${this.name}]</b> ${formatChampionName(user)} estendeu a mão sobre o campo; cada um dos demais aliados agora subtrai ${subtraction} de cada golpe.`,
        },
      });

      return logs;
    },
  },

  {
    key: "the_valley_turns_over",
    name: "The Valley Turns Over",
    bf: 30,
    damageMode: "standard",
    defenseGapRatio: 0.8,
    maxGapBonus: 110,
    cannotBeEvaded: true,
    contact: true,
    isUltimate: true,
    momentumCost: 60,
    priority: 0,
    sedimentGain: 4,

    description() {
      return {
        en: `Bergrisa takes the floor of the world in both hands and tips it, and everything standing on it goes down with the stone. She strikes every enemy carrying <b>${this.defenseGapRatio * 100}%</b> of the <b>Defense</b> gap as bonus damage, up to <b>${this.maxGapBonus}</b>, rather than <b>Strata</b>'s usual share, and settles <b>${this.sedimentGain}</b> <b>Sediment</b> into herself. Deals physical damage.`,
        pt: `Bergrisa toma o chão do mundo com as duas mãos e o vira, e tudo que estiver sobre ele desaba junto com a pedra. Ela atinge cada inimigo carregando <b>${this.defenseGapRatio * 100}%</b> da diferença de <b>Defesa</b> como dano bônus, até <b>${this.maxGapBonus}</b>, em vez da parcela usual de <b>Strata</b>, e acumula <b>${this.sedimentGain}</b> de <b>Sedimento</b> em si mesma. Causa dano físico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const results = strikeAll(this, user, targets, context);

      passive.setSediment(
        user,
        (user.runtime?.bergrisaSediment || 0) + this.sedimentGain,
        context,
      );

      return results;
    },
  },
];

export default bergrisaSkills;
