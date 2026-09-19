export type OwnerRow = {
  id: string;
  name: string;
  entity_type: string;
  ownership_pct: number | null;
  parent_owner_id: string | null;
  control_role: string | null;
  screening_status: string;
};

export type OwnerComputed = {
  id: string;
  name: string;
  effectivePct: number;
  isUbo: boolean;
  controlBasis: string;
};

export const UBO_THRESHOLD = 25;
export const BLOCKED_OWNERSHIP_THRESHOLD = 50;

/**
 * Walks layered holdings and multiplies ownership down the chain
 * (FATF R.24/R.25, PCMLTFR s.138, AMLR Arts. 51-57, CTA 31 CFR 1010.380).
 */
export function computeEffectiveOwnership(owners: OwnerRow[]): OwnerComputed[] {
  const byId = new Map(owners.map((o) => [o.id, o]));

  function chainPct(owner: OwnerRow, depth = 0): number {
    const own = Number(owner.ownership_pct ?? 0) / 100;
    if (depth > 8) return own;
    const parent = owner.parent_owner_id ? byId.get(owner.parent_owner_id) : undefined;
    if (!parent) return own;
    return own * chainPct(parent, depth + 1);
  }

  // Aggregate by normalised name so split holdings count together.
  const totals = new Map<string, number>();
  for (const o of owners) {
    const key = o.name.trim().toLowerCase();
    totals.set(key, (totals.get(key) ?? 0) + chainPct(o, 0) * 100);
  }

  return owners.map((o) => {
    const effective = Math.round((totals.get(o.name.trim().toLowerCase()) ?? 0) * 100) / 100;
    const senior = /director|officer|ceo|cfo|president|manager|signing/i.test(o.control_role ?? "");
    const isUbo = effective >= UBO_THRESHOLD || senior;
    const basis =
      effective >= UBO_THRESHOLD
        ? o.parent_owner_id
          ? `Indirect ownership of ${effective}% through a holding structure`
          : `Direct ownership of ${effective}%`
        : senior
          ? "Control through a senior management or signing role"
          : `Below the ${UBO_THRESHOLD}% threshold`;
    return { id: o.id, name: o.name, effectivePct: effective, isUbo, controlBasis: basis };
  });
}

/**
 * OFAC 50 Percent Rule: an entity is blocked when blocked persons own
 * 50% or more in aggregate, directly or indirectly.
 */
export function fiftyPercentRule(owners: OwnerRow[], computed: OwnerComputed[]) {
  const sanctioned = owners.filter((o) => o.screening_status === "hit");
  const total = sanctioned.reduce((sum, o) => {
    const c = computed.find((x) => x.id === o.id);
    return sum + (c?.effectivePct ?? 0);
  }, 0);
  const rounded = Math.round(total * 100) / 100;
  return {
    sanctionedOwnership: rounded,
    blocked: rounded >= BLOCKED_OWNERSHIP_THRESHOLD,
    names: sanctioned.map((o) => o.name),
    citation: "OFAC Revised Guidance on Entities Owned by Blocked Persons (50 Percent Rule)",
  };
}
