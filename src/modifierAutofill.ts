import type { CategoryId, MenuItem, ModifierGroup } from './data/menu'

export interface ModifierTarget {
  id?: string | null
  name: string
  category: CategoryId
}

/** IDs belong to each item's groups; copying values must never share editable objects. */
export const cloneModifierGroups = (groups: readonly ModifierGroup[] = []): ModifierGroup[] =>
  groups.map((group) => ({ ...group, options: group.options.map((option) => ({ ...option })) }))

const normalizedName = (name: string) =>
  name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim()

function validGroups(groups: MenuItem['modifiers']): groups is ModifierGroup[] {
  if (!Array.isArray(groups) || groups.length === 0) return false
  return groups.every((group) =>
    group && typeof group.id === 'string' && group.id.trim() &&
    typeof group.name === 'string' && normalizedName(group.name) &&
    typeof group.required === 'boolean' && typeof group.multi === 'boolean' &&
    Array.isArray(group.options) && group.options.length > 0 &&
    group.options.every((option) =>
      option && typeof option.id === 'string' && option.id.trim() &&
      typeof option.name === 'string' && normalizedName(option.name) &&
      Number.isSafeInteger(option.price) && option.price >= 0,
    ) &&
    new Set(group.options.map((option) => option.id)).size === group.options.length &&
    new Set(group.options.map((option) => option.name.trim())).size === group.options.length,
  ) && new Set(groups.map((group) => group.id)).size === groups.length
}

/** Valid same-category choices for automatic suggestions and explicit copying. */
export const modifierSources = (menu: readonly MenuItem[], target: ModifierTarget): MenuItem[] =>
  menu.filter((item) => item.id !== target.id && item.category === target.category && validGroups(item.modifiers))

// Shared packaging/size words do not identify the product whose settings should be copied.
const genericWords = new Set([
  'a', 'an', 'and', 'the', 'with', 'without', 'of', 'for', 'new', 'fresh', 'special',
  'classic', 'original', 'regular', 'standard', 'normal', 'small', 'medium', 'large',
  'mini', 'big', 'jumbo', 'extra', 'xl', 'xxl', 'xxxl', 'xs', 'size', 'sized',
  'hot', 'cold', 'iced', 'ice', 'cup', 'glass', 'bottle', 'can', 'drink', 'drinks',
  'beverage', 'beverages', 'soft', 'soda', 'juice', 'food', 'item', 'menu', 'combo',
  'meal', 'portion', 'piece', 'pieces', 'pcs', 'pack', 'set', 'litre', 'litres',
  'liter', 'liters', 'ltr', 'ounce', 'ounces',
])

const meaningfulTokens = (name: string) => new Set(
  normalizedName(name).split(' ').filter((token) =>
    token.length >= 3 && /\p{L}/u.test(token) && !genericWords.has(token) &&
    !/^\d+(?:ml|cl|dl|l|ltr|litres?|liters?|oz|g|kg|pcs?)$/u.test(token),
  ),
)

function nameSimilarity(target: string, source: string): number {
  const targetWords = meaningfulTokens(target)
  const sourceWords = meaningfulTokens(source)
  if (targetWords.size > 0 && normalizedName(target) === normalizedName(source)) return 1000
  const shared = [...targetWords].filter((word) => sourceWords.has(word))
  if (shared.length === 0) return 0
  // A shared brand/product word must cover a substantial part of both names.
  // Several matching meaningful words are strong evidence even in longer names.
  if (shared.length < 2 && (
    shared[0].length < 4 || shared.length / targetWords.size < 0.5 || shared.length / sourceWords.size < 0.5
  )) return 0
  return shared.length * 10 + shared.length / (targetWords.size + sourceWords.size - shared.length)
}

const settingsSignature = (groups: ModifierGroup[]) => JSON.stringify(groups.map((group) => [
  normalizedName(group.name), group.required, group.multi,
  group.options.map((option) => [normalizedName(option.name), option.price]),
]))

/** Prefer a consistent category template; conflicting setups require a clear product-name match. */
export function suggestModifierSource(menu: readonly MenuItem[], target: ModifierTarget): MenuItem | undefined {
  if (!target.name.trim()) return undefined
  const sources = modifierSources(menu, target)
  if (sources.length === 0) return undefined
  const ranked = sources.map((item) => ({ item, score: nameSimilarity(target.name, item.name) }))
    .sort((a, b) => b.score - a.score)
  const signatures = new Set(sources.map((item) => settingsSignature(item.modifiers!)))
  if (signatures.size === 1) return ranked[0].item
  const [best, next] = ranked
  const onlyStrongMatch = best.score > 0 && next.score === 0
  const uniqueExactMatch = best.score === 1000 && next.score < 1000
  return onlyStrongMatch || uniqueExactMatch ? best.item : undefined
}
