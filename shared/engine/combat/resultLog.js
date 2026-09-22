/** Appends an entry to a damage result's log, which is always a list so that
 *  bilingual { en, pt } entries reach the client unflattened. */
export function pushResultLog(result, entry) {
  if (!result || !entry) return result;

  if (Array.isArray(result.log)) result.log.push(entry);
  else if (result.log) result.log = [result.log, entry];
  else result.log = [entry];

  return result;
}
