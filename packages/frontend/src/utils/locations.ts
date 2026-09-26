// ========================================================================
// Central School Location & Branch Formatting Helper
// Standardizes branch display labels and select dropdown options across
// all inventory modules, purchase orders, sales orders, and audit ledgers.
// ========================================================================

import { Location } from '../types/index.js';

/**
 * Returns a formatted branch label with code for select dropdowns.
 * Example: "Dwarka Main Campus (DEL-MAIN)" or "Noida Extension Campus (NOI-EXT)"
 */
export function formatLocationOptionLabel(loc?: Partial<Location> | null): string {
  if (!loc) return 'Main Campus';
  const name = loc.location_name || loc.name || 'Main Campus';
  const code = loc.location_code || loc.code || loc.school_id_code;
  return code ? `${name} (${code})` : name;
}

/**
 * Returns a clean branch name for tables, modals, and text badges.
 * Example: "Dwarka Main Campus"
 */
export function formatLocationDisplay(loc?: Partial<Location> | null): string {
  if (!loc) return 'Main Campus';
  return loc.location_name || loc.name || 'Main Campus';
}

export interface LocationOptionsConfig {
  includeAll?: boolean;
  allLabel?: string;
  permittedLocationIds?: string[];
  activeOnly?: boolean;
}

/**
 * Converts a list of Location records into standard dropdown options with UUID values.
 */
export function getLocationSelectOptions(
  locations: Location[] = [],
  config?: LocationOptionsConfig
): Array<{ value: string; label: string }> {
  let list = Array.isArray(locations) ? locations : [];

  if (config?.permittedLocationIds && config.permittedLocationIds.length > 0) {
    list = list.filter(l => config.permittedLocationIds!.includes(l.id));
  }

  if (config?.activeOnly) {
    list = list.filter(l => l.status === 'ACTIVE' || !l.status);
  }

  const mapped = list.map(l => ({
    value: l.id,
    label: formatLocationOptionLabel(l),
  }));

  if (config?.includeAll) {
    return [{ value: '', label: config.allLabel || 'All Branches' }, ...mapped];
  }

  return mapped;
}
