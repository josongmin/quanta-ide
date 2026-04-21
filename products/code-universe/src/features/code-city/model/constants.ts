/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const THEME = {
  bg: "#FFFFFF",
  grid: "#E2E8F0",
  sky: "#F0F9FF",
  buildingBase: "#E2E8F0",
  neonBlue: "#3B82F6",
  neonPink: "#EF4444",
  neonGreen: "#22C55E",
  fire: "#F97316",
  toxic: "#84CC16",
  ghost: "#CBD5E1",
} as const;

/** Cap building count so large repos stay interactive. */
export const CODE_CITY_MAX_BUILDINGS = 80;
