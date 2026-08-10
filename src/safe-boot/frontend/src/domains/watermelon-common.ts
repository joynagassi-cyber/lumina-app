/**
 * WatermelonDB — colonnes SQLite standard partagées.
 *
 * ADR-003: `id` et `_status`/`_changed` requis sur chaque table.
 * Les schémas de domaine étendent ce tableau via `...sqliteColumns`.
 *
 * Convention `isNullable` : alignée sur le type de retour des fonctions
 * getXxxSchema() des domaines (et sur le mapping du bootstrap SQLite).
 */

export const sqliteColumns: ReadonlyArray<{
  name: string;
  type: string;
  isNullable?: boolean;
  isIndexed?: boolean;
}> = [
  { name: 'id', type: 'string' },
  { name: '_status', type: 'string', isNullable: true },
  { name: '_changed', type: 'string', isNullable: true },
];
