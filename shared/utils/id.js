export function generateId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  // randomUUID only exists in secure contexts, so LAN-served pages fall back here.
  const rand = Math.random().toString(36).slice(2, 10);

  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
