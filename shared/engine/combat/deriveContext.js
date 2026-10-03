// A child context for a nested event (reaction, DoT tick, recoil...). Copies
// descriptors rather than values so getters such as matchChampions stay live
// instead of freezing into a snapshot of the parent's field.
export function deriveContext(parent, overrides) {
  const context = Object.defineProperties(
    {},
    Object.getOwnPropertyDescriptors(parent ?? {}),
  );
  return Object.assign(context, overrides);
}
