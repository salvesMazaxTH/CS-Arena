import { emitCombatEvent } from "../combatEvents.js";
import { composeDamage } from "./03_composeDamage.js";

export function runBeforeHooks(event) {
  // Absolute hits reach the hooks too, but canRunHook filters every listener
  // out unless its kit opts in with hookPolicies.<event>.allowOnAbsolute.

  const preHookCrit = _snapshotCrit(event.crit);
  const basePreMitigationDamage = event.preMitigationDamage ?? event.damage;
  const preHookBaseDamage = Number(event.baseDamage ?? 0);

  const deal = _applyBeforeDealingPassive(event);
  const take = _applyBeforeTakingPassive(event);

  const critWasChanged =
    deal.critChanged ||
    take.critChanged ||
    !_isSameCrit(preHookCrit, _snapshotCrit(event.crit));

  const damageModelWasChanged =
    deal.damageModelChanged || take.damageModelChanged;

  if (critWasChanged || damageModelWasChanged) {
    // Recompõe usando dano pré-mitigação para que mudança de crítico
    // impacte defesa, mitigação e dano final da mesma forma do step 3.
    const preMitigationFromHooks =
      take.preMitigationDamage ?? deal.preMitigationDamage;

    if (typeof preMitigationFromHooks === "number") {
      event.damage = preMitigationFromHooks;
    } else if (
      damageModelWasChanged &&
      preHookBaseDamage > 0 &&
      Number(event.baseDamage ?? 0) > 0
    ) {
      // Mantém proporção de quaisquer ajustes feitos no step 2
      // quando o hook altera o baseDamage no step 4.
      const ratio = Number(event.baseDamage) / preHookBaseDamage;
      event.damage = basePreMitigationDamage * ratio;
    } else {
      event.damage = basePreMitigationDamage;
    }

    composeDamage(event);

    event.damage = _carryHookDamage(event.damage, deal);
    event.damage = _carryHookDamage(event.damage, take);
  }

  // Consolida logs e efeitos no estado da classe/contexto
  if (deal.logs.length) event.beforeLogs.push(...deal.logs);
  if (take.logs.length) event.beforeLogs.push(...take.logs);

  if (event.crit?.didCrit) {
    emitCombatEvent(
      "onCriticalHit",
      {
        attacker: event.attacker,
        defender: event.defender,
        context: event.context,
        forced: event.crit?.forced,
      },
      event.allChampions ?? event.context?.allChampions,
    );
  }
}

// Increases carry as a flat amount, reductions as a proportion, a cap as a plain ceiling.
function _carryHookDamage(damage, phase) {
  if (phase.sawDamageOverride) {
    damage = (damage + phase.damageDelta) * phase.damageRatio;
  }

  return Math.min(damage, phase.damageCap);
}

// Every hook of a phase reads the same payload snapshot, so what each one asks
// for is a delta against that snapshot: increases add up, reductions multiply.
function _composedField(starting, ceiling = Infinity) {
  return {
    starting: Number(starting) || 0,
    ceiling,
    delta: 0,
    scale: 1,
    floor: 0,
    ratio: 1,
    saw: false,

    apply(requested) {
      const value = Number(requested) || 0;
      this.saw = true;

      if (value > this.starting) this.delta += value - this.starting;
      else if (this.starting > 0) this.ratio *= value / this.starting;
    },

    scaleBy(multiplier) {
      this.scale *= Number(multiplier) || 1;
      this.saw = true;
    },

    raiseFloor(minimum) {
      this.floor = Math.max(this.floor, Number(minimum) || 0);
      this.saw = true;
    },

    get value() {
      const raised = Math.max(
        (this.starting + this.delta) * this.scale,
        this.floor,
      );

      // Reductions come last so a denial still wins over a scale or a floor.
      return Math.min(raised, this.ceiling) * this.ratio;
    },
  };
}

// Within one phase a denial outranks a pierce, and Absolute outranks both.
const MODE_RANK = { piercing: 0, standard: 1, absolute: 2 };

function _strongerMode(current, next) {
  if (current === undefined) return next;
  return (MODE_RANK[next] ?? 0) > (MODE_RANK[current] ?? 0) ? next : current;
}

function _applyBeforeDealingPassive(event) {
  return _processHook(event, "onBeforeDmgDealing", {
    mode: event.mode,
    damage: event.damage,
    baseDamage: event.baseDamage,
    bonusDamage: event.bonusDamage,
    preMitigationDamage: event.preMitigationDamage,
    piercingPercentage: event.piercingPercentage,
    crit: event.crit,
    skill: event.skill,
    hitId: event.hitId,
    element: event.element,
    contact: event.contact,
    attacker: event.attacker,
    defender: event.defender,
    context: event.context,
  });
}

function _applyBeforeTakingPassive(event) {
  return _processHook(event, "onBeforeDmgTaking", {
    mode: event.mode,
    damage: event.damage,
    baseDamage: event.baseDamage,
    bonusDamage: event.bonusDamage,
    preMitigationDamage: event.preMitigationDamage,
    piercingPercentage: event.piercingPercentage,
    crit: event.crit,
    skill: event.skill,
    hitId: event.hitId,
    element: event.element,
    contact: event.contact,
    attacker: event.attacker,
    defender: event.defender,
    context: event.context,
    type: event.type,
  });
}

function _processHook(event, eventName, payload) {
  // JSON.stringify força o JS a ler o valor exato AGORA, sem preguiça de log
  /*   console.log("[ALL CHAMPIONS DEBUG]", event.allChampions); */

  // Verifique se o event.allChampions não foi redefinido por acidente
  if (!event.allChampions || event.allChampions.length === 0) {
    /*  console.error("❌ ERRO CRÍTICO: allChampions sumiu antes do emit!"); */
  }
  const results =
    emitCombatEvent(eventName, payload, event.allChampions, {
      players: event.players,
      canRun: (name, champ, source) => event.canRunHook(name, champ, source),
    }) || [];
  const summary = {
    logs: [],
    critChanged: false,
    damageModelChanged: false,
    preMitigationDamage: undefined,

    // How this phase moved `damage`, kept so a later recompose can carry it.
    sawDamageOverride: false,
    damageRatio: 1,
    damageDelta: 0,
    damageCap: Infinity,
  };

  const damage = _composedField(payload.damage);
  const baseDamage = _composedField(payload.baseDamage);
  const preMitigation = _composedField(
    payload.preMitigationDamage ?? payload.damage,
  );
  const piercing = _composedField(payload.piercingPercentage, 100);
  let mode;
  let damageCap = Infinity;
  let bonusAdded = 0;

  for (const r of results) {
    if (!r) continue;

    // Caso legado: Array direto de logs
    if (Array.isArray(r)) {
      summary.logs.push(...r);
      continue;
    }

    // Mutação de estado do evento
    if (r.damage !== undefined) {
      damage.apply(r.damage);
    }
    // A ceiling, not a damage value: it must not scale with the hit.
    if (r.damageCap !== undefined) {
      damageCap = Math.min(damageCap, Number(r.damageCap));
    }
    // A flat semi-absolute rider: joins the total unmitigated, like a skill's
    // bonusDamage. Additive so several hooks can each contribute.
    if (r.bonusDamage !== undefined) {
      bonusAdded += Number(r.bonusDamage) || 0;
    }
    if (r.baseDamage !== undefined) {
      baseDamage.apply(r.baseDamage);
    }
    if (r.mode !== undefined) {
      mode = _strongerMode(mode, r.mode);
    }
    if (r.piercingPercentage !== undefined) {
      piercing.apply(r.piercingPercentage);
    }
    if (r.piercingMultiplier !== undefined) {
      piercing.scaleBy(r.piercingMultiplier);
    }
    if (r.piercingFloor !== undefined) {
      piercing.raiseFloor(r.piercingFloor);
    }
    if (r.preMitigationDamage !== undefined) {
      preMitigation.apply(r.preMitigationDamage);
    }
    if (r.crit !== undefined) {
      summary.critChanged = true;
      event.crit = r.crit;
    }

    // Consolidação de Logs e Effects (Uso de set de chaves para enxugar)
    ["log", "logs"].forEach((key) => {
      if (r[key]) {
        const val = Array.isArray(r[key]) ? r[key] : [r[key]];
        summary.logs.push(...val);
      }
    });
  }

  if (baseDamage.saw) {
    event.baseDamage = baseDamage.value;
    summary.damageModelChanged = true;
  }

  if (mode !== undefined) {
    event.mode = mode;
    summary.damageModelChanged = true;
  }

  if (piercing.saw) {
    event.piercingPercentage = Math.max(0, Math.min(100, piercing.value));
    summary.damageModelChanged = true;
  }

  if (preMitigation.saw) {
    summary.preMitigationDamage = preMitigation.value;
    summary.damageModelChanged = true;
  }

  if (damage.saw) {
    event.damage = damage.value;

    summary.sawDamageOverride = true;
    summary.damageRatio = damage.ratio;
    summary.damageDelta = damage.delta;
  }

  if (Number.isFinite(damageCap)) {
    event.damage = Math.min(event.damage, damageCap);
    summary.damageCap = damageCap;
  }

  if (bonusAdded) {
    event.bonusDamage = (Number(event.bonusDamage) || 0) + bonusAdded;
    // composeDamage already folded the pre-hook rider into event.damage; keep it
    // in sync here. A later recompose resets from preMitigation and re-adds the
    // whole event.bonusDamage, so this never double-counts.
    event.damage += bonusAdded;

    const cap = event.constructor?.GLOBAL_DMG_CAP;
    if (Number.isFinite(cap)) event.damage = Math.min(event.damage, cap);
  }

  return summary;
}

function _snapshotCrit(crit) {
  if (!crit) return null;
  return {
    didCrit: !!crit.didCrit,
    bonus: Number(crit.bonus ?? 0),
    critExtra: Number(crit.critExtra ?? 0),
    forced: !!crit.forced,
    disabled: !!crit.disabled,
  };
}

function _isSameCrit(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.didCrit === b.didCrit &&
    a.bonus === b.bonus &&
    a.critExtra === b.critExtra &&
    a.forced === b.forced &&
    a.disabled === b.disabled
  );
}
