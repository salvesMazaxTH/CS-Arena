// Every entry's title and description are { en, pt } pairs. A term is found
// in a description by its title in the reader's language, plus that
// language's aliases; English also matches the bare key ("stunned").
export const GAME_GLOSSARY = {
  absolute: {
    title: { en: "Absolute Damage", pt: "Dano Absoluto" },
    description: {
      en: "Ignores Defense, shields, and reductions. Cannot crit or be modified.",
      pt: "Ignora Defesa, escudos e reduções. Não pode ser crítico nem modificado.",
    },
  },
  stunned: {
    title: { en: "Stunned", pt: "Atordoado" },
    aliases: { pt: ["Atordoada"] },
    description: {
      en: "The champion is temporarily unable to act.",
      pt: "O campeão fica temporariamente incapaz de agir.",
    },
  },
  conductor: {
    title: { en: "Conductor", pt: "Condutor" },
    description: {
      en: "Amplifies lightning abilities.",
      pt: "Amplifica habilidades de raio.",
    },
  },
  frozen: {
    title: { en: "Frozen", pt: "Congelado" },
    aliases: { pt: ["Congelada"] },
    description: {
      en: "The champion is temporarily unable to act. Speed and Attack are set to zero. Applies on any hit that connects, even one that deals no damage.",
      pt: "O campeão fica temporariamente incapaz de agir. Velocidade e Ataque caem a zero. É aplicado por qualquer golpe que acerte, mesmo um que não cause dano.",
    },
  },
  rooted: {
    title: { en: "Rooted", pt: "Enraizado" },
    aliases: { pt: ["Enraizada"] },
    description: {
      en: "The champion is rooted in place, unable to act with abilities that require contact. Applies on any hit that connects, even one that deals no damage.",
      pt: "O campeão fica preso ao chão e não pode usar habilidades que exigem contato. É aplicado por qualquer golpe que acerte, mesmo um que não cause dano.",
    },
  },
  snared: {
    title: { en: "Snared", pt: "Enredado" },
    aliases: { pt: ["Enredada"] },
    description: {
      en: "The champion is snared, unable to act with abilities that require contact. Applies on any hit that connects, even one that deals no damage.",
      pt: "O campeão fica enredado e não pode usar habilidades que exigem contato. É aplicado por qualquer golpe que acerte, mesmo um que não cause dano.",
    },
  },
  blind: {
    title: { en: "Blind", pt: "Cego" },
    aliases: { pt: ["Cega"] },
    description: {
      en: "An ability aimed at a single enemy has a 75% chance to miss. Area abilities are unaffected, and so is any target the player did not choose.",
      pt: "Uma habilidade mirada em um único inimigo tem 75% de chance de errar. Habilidades em área não são afetadas, nem qualquer alvo que o jogador não tenha escolhido.",
    },
  },
  poisoned: {
    title: { en: "Poisoned", pt: "Envenenado" },
    aliases: { pt: ["Envenenada"] },
    description: {
      en: "At the start of the turn, deals magic damage over time equal to 4% of maximum HP per stack. Each application adds its stacks as a separate batch that lasts 2 turns, so older stacks run out while fresh ones keep going. Holds at most 12 stacks; past that, the oldest stacks give way to the new ones. Damage over time never triggers reactive effects. Applies on any hit that connects, even one that deals no damage.",
      pt: "No início do turno, causa dano mágico contínuo igual a 4% do HP máximo por acúmulo. Cada aplicação traz seus acúmulos como um lote próprio que dura 2 turnos, então os acúmulos antigos se esgotam enquanto os novos seguem valendo. Comporta no máximo 12 acúmulos; acima disso, os mais antigos dão lugar aos novos. Dano contínuo nunca ativa efeitos reativos. É aplicado por qualquer golpe que acerte, mesmo um que não cause dano.",
    },
  },
  healBlock: {
    title: { en: "Heal Block", pt: "Bloqueio de Cura" },
    description: {
      en: "The champion cannot recover HP by any means, lifesteal included. Requires the attack to deal damage.",
      pt: "O campeão não pode recuperar HP de forma alguma, roubo de vida incluso. Exige que o ataque cause dano.",
    },
  },
  afflictionWard: {
    title: { en: "Affliction Ward", pt: "Proteção contra Aflição" },
    description: {
      en: "The first negative effect that would take hold never does, and the ward is spent turning it away. It stops nothing that merely deals damage.",
      pt: "O primeiro efeito negativo que pegaria no campeão nunca pega, e a proteção se gasta ao repeli-lo. Não impede nada que apenas cause dano.",
    },
  },
  spell_shield: {
    title: { en: "Spell Shield", pt: "Escudo Mágico" },
    description: {
      en: "The champion receives a shield that absorbs the next magic damage.",
      pt: "O campeão recebe um escudo que absorve o próximo dano mágico.",
    },
  },
  chilled: {
    title: { en: "Chilled", pt: "Gelado" },
    aliases: { pt: ["Gelada"] },
    description: {
      en: "The champion's speed and attack are reduced. Applies on any hit that connects, even one that deals no damage.",
      pt: "A velocidade e o ataque do campeão são reduzidos. É aplicado por qualquer golpe que acerte, mesmo um que não cause dano.",
    },
  },
  thorns: {
    title: { en: "Thorns", pt: "Espinhos" },
    description: {
      en: "Every contact hit the champion takes returns part of the damage to the attacker, ignoring Defense — even the blow that kills them. Comes in tiers I to V (10% / 15% / 20% / 25% / 30%); applying it again raises the tier, and it never wears off.",
      pt: "Todo golpe de contato que o campeão sofre devolve parte do dano ao atacante, ignorando a Defesa — até o golpe que o derruba. Tem níveis de I a V (10% / 15% / 20% / 25% / 30%); aplicá-lo de novo sobe o nível, e ele nunca se esgota.",
    },
  },
  absolute_immunity: {
    title: { en: "Absolute Immunity", pt: "Imunidade Absoluta" },
    description: {
      en: "The champion is immune to all types of negative effects (including damage).",
      pt: "O campeão é imune a todo tipo de efeito negativo (dano incluso).",
    },
  },
  inert: {
    title: { en: "Inert", pt: "Inerte" },
    description: {
      en: "The champion is unable to act (usually self-provoked).",
      pt: "O campeão fica incapaz de agir (em geral, autoimposto).",
    },
  },
  invisible: {
    title: { en: "Invisible", pt: "Invisível" },
    description: {
      en: "The champion cannot be directly targeted by enemies, only affected indirectly and by area effects.",
      pt: "O campeão não pode ser alvo direto de inimigos; só é afetado indiretamente e por efeitos em área.",
    },
  },
  concealed: {
    title: { en: "Concealed", pt: "Oculto" },
    aliases: { pt: ["Oculta"] },
    description: {
      en: "Only the enemy directly opposite the champion can land a hit. Taking any damage, or acting, ends it.",
      pt: "Só o inimigo bem à frente do campeão consegue acertá-lo. Sofrer qualquer dano, ou agir, encerra o efeito.",
    },
  },
  obliterate: {
    title: { en: "Obliterate", pt: "Obliterar" },
    aliases: {
      pt: [
        "obliterado",
        "obliterados",
        "obliterada",
        "obliteradas",
        "obliteração",
      ],
    },
    description: {
      en: "The champion is instantly defeated upon dropping below a certain amount of HP and/or meeting some other condition.",
      pt: "O campeão é derrotado na hora ao cair abaixo de certa quantidade de HP e/ou ao cumprir alguma outra condição.",
    },
  },
  paralyzed: {
    title: { en: "Paralyzed", pt: "Paralisado" },
    aliases: { pt: ["Paralisada"] },
    description: {
      en: "The champion's SPD is set to zero and has a 40% chance of not acting. Requires the attack to deal damage.",
      pt: "A Velocidade do campeão cai a zero e ele tem 40% de chance de não agir. Exige que o ataque cause dano.",
    },
  },
  piercing: {
    title: { en: "Piercing", pt: "Perfurante" },
    aliases: { pt: ["perfuração"] },
    description: {
      en: "Ignores a percentage of Defense, but can still crit and be affected by bonuses or reductions.",
      pt: "Ignora uma porcentagem da Defesa, mas ainda pode ser crítico e ser afetado por bônus ou reduções.",
    },
  },
  burning: {
    title: { en: "Burning", pt: "Queimando" },
    description: {
      en: "At the start of the turn, deals magic damage over time equal to 15 plus 4% of maximum HP. While Burning, all HP the champion recovers is reduced by 35%. Damage over time never triggers reactive effects. Requires the attack to deal damage; some sources bypass this.",
      pt: "No início do turno, causa dano mágico contínuo igual a 15 mais 4% do HP máximo. Enquanto estiver Queimando, todo HP que o campeão recupera é reduzido em 35%. Dano contínuo nunca ativa efeitos reativos. Exige que o ataque cause dano; algumas fontes ignoram essa exigência.",
    },
  },
  bleeding: {
    title: { en: "Bleeding", pt: "Sangrando" },
    description: {
      en: "At the start of the turn, deals physical damage over time equal to 4% of maximum HP per stack. Each application adds its stacks as a separate batch that lasts 2 turns, so older stacks run out while fresh ones keep going. Holds at most 12 stacks; past that, the oldest stacks give way to the new ones. Damage over time never triggers reactive effects. Requires the attack to deal damage; some sources bypass this.",
      pt: "No início do turno, causa dano físico contínuo igual a 4% do HP máximo por acúmulo. Cada aplicação traz seus acúmulos como um lote próprio que dura 2 turnos, então os acúmulos antigos se esgotam enquanto os novos seguem valendo. Comporta no máximo 12 acúmulos; acima disso, os mais antigos dão lugar aos novos. Dano contínuo nunca ativa efeitos reativos. Exige que o ataque cause dano; algumas fontes ignoram essa exigência.",
    },
  },
};
