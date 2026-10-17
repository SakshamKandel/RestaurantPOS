// Run with: node scripts/modifier-autofill-test.cjs
// Transpiles only the pure helper; no app, installed database, or browser is opened.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const sourcePath = path.resolve(__dirname, '../src/modifierAutofill.ts')
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  fileName: sourcePath,
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
})
const helperModule = { exports: {} }
vm.runInNewContext(compiled.outputText, { module: helperModule, exports: helperModule.exports }, { filename: sourcePath })
const { cloneModifierGroups, modifierSources, suggestModifierSource } = helperModule.exports
const plain = (value) => JSON.parse(JSON.stringify(value))

const sizeGroups = () => [{
  id: 'size', name: 'Size', required: true, multi: false,
  options: [{ id: 'regular', name: 'Regular', price: 0 }, { id: 'large', name: 'Large', price: 100 }],
}]
const item = (id, name, category = 'drinks', modifiers = sizeGroups()) => ({
  id, name, category, modifiers, price: 200, available: true, image: '', emoji: '🥤',
})
const target = (name = 'Fanta', category = 'drinks', id) => ({ id, name, category })
let passed = 0
const test = (name, run) => { run(); passed += 1; console.log(`PASS ${name}`) }

test('a single Drinks template automatically suggests Coca Cola settings for Fanta', () => {
  const cola = item('cola', 'Coca Cola')
  assert.equal(suggestModifierSource([cola], target()), cola)
})

test('uniform settings ignore per-item IDs and Unicode label punctuation/case', () => {
  const cola = item('cola', 'Coca Cola')
  const pepsiGroups = sizeGroups().map((group) => ({
    ...group, id: 'other-size', name: 'ＳＩＺＥ',
    options: group.options.map((option, index) => ({ ...option, id: `other-${index}`, name: option.name.toUpperCase() })),
  }))
  const pepsi = item('pepsi', 'Pepsi', 'drinks', pepsiGroups)
  assert.equal(suggestModifierSource([cola, pepsi], target()), cola)
  assert.equal(suggestModifierSource([cola, pepsi], target('Pepsi Max')), pepsi)
})

test('different category settings and the target itself are excluded from source choices', () => {
  const cola = item('cola', 'Coca Cola')
  const fanta = item('fanta', 'Fanta')
  const burger = item('burger', 'Burger', 'meals')
  assert.deepEqual(plain(modifierSources([cola, fanta, burger], target('Fanta', 'drinks', 'fanta'))).map((source) => source.id), ['cola'])
  assert.equal(suggestModifierSource([fanta, burger], target('Fanta', 'drinks', 'fanta')), undefined)
})

test('empty, incomplete, malformed, duplicate-option, and invalid-price settings are excluded', () => {
  const valid = item('valid', 'Coca Cola')
  const invalid = [
    undefined, [], [null], [{ ...sizeGroups()[0], name: ' ' }],
    [{ ...sizeGroups()[0], options: [] }], [{ ...sizeGroups()[0], options: [{ id: 'x', name: ' ', price: 0 }] }],
    [{ ...sizeGroups()[0], options: [{ id: 'x', name: 'Regular', price: -1 }] }],
    [{ ...sizeGroups()[0], options: [{ id: 'x', name: 'Regular', price: NaN }] }],
    [{ ...sizeGroups()[0], options: [{ id: 'x', name: 'Regular', price: 1.5 }] }],
    [{ ...sizeGroups()[0], options: [{ id: 'x', name: 'Regular', price: 0 }, { id: 'y', name: 'Regular', price: 1 }] }],
  ]
  const candidates = invalid.map((modifiers, index) => ({ ...item(`invalid-${index}`, 'Fanta'), modifiers }))
  assert.deepEqual(plain(modifierSources([...candidates, valid], target())).map((source) => source.id), ['valid'])
})

test('conflicting category templates do not guess without a unique strong name match', () => {
  const cola = item('cola', 'Coca Cola')
  const shake = item('shake', 'Milkshake', 'drinks', [{
    id: 'flavour', name: 'Flavour', required: false, multi: true,
    options: [{ id: 'vanilla', name: 'Vanilla', price: 50 }],
  }])
  assert.equal(suggestModifierSource([cola, shake], target()), undefined)
  assert.equal(suggestModifierSource([cola, shake], target('COCA—COLA zero')), cola)
})

test('generic words, sizes, and packaging alone are not strong matches', () => {
  const small = item('cola', 'Small Coca Cola 500ml bottle')
  const large = item('shake', 'Large Milkshake 500ml bottle', 'drinks', [{
    ...sizeGroups()[0], multi: true,
  }])
  assert.equal(suggestModifierSource([small, large], target('Large Fanta 500ml bottle')), undefined)
})

test('tied product-name evidence leaves conflicting templates for an explicit choice', () => {
  const regular = item('regular', 'Coca Cola Original')
  const zero = item('zero', 'Coca Cola Zero', 'drinks', [{ ...sizeGroups()[0], required: false }])
  assert.equal(suggestModifierSource([regular, zero], target('Coca Cola Cherry')), undefined)
  assert.equal(suggestModifierSource([regular, zero], target('COCA—COLA ZERO')), zero)
})

test('settings signatures include choice type, required flag, prices, names, and ordering', () => {
  const original = item('a', 'First product')
  const variants = [
    [{ ...sizeGroups()[0], required: false }],
    [{ ...sizeGroups()[0], multi: true }],
    [{ ...sizeGroups()[0], name: 'Portion' }],
    [{ ...sizeGroups()[0], options: [...sizeGroups()[0].options].reverse() }],
    [{ ...sizeGroups()[0], options: sizeGroups()[0].options.map((option) => ({ ...option, price: option.price + 10 })) }],
    [{ ...sizeGroups()[0], options: sizeGroups()[0].options.map((option) => ({ ...option, name: `${option.name} changed` })) }],
  ]
  for (const modifiers of variants) {
    assert.equal(suggestModifierSource([original, item('b', 'Second product', 'drinks', modifiers)], target()), undefined)
  }
})

test('blank item names and categories without eligible sources do not auto-fill', () => {
  const cola = item('cola', 'Coca Cola')
  assert.equal(suggestModifierSource([cola], target('   ')), undefined)
  assert.equal(suggestModifierSource([cola], target('Fanta', 'meals')), undefined)
  assert.equal(suggestModifierSource([], target()), undefined)
})

test('copied group and option values can be edited independently while IDs stay item-scoped', () => {
  const source = item('cola', 'Coca Cola')
  const snapshot = JSON.stringify(source)
  const first = cloneModifierGroups(source.modifiers)
  const second = cloneModifierGroups(source.modifiers)
  assert.notEqual(first, source.modifiers)
  assert.notEqual(first[0], source.modifiers[0])
  assert.notEqual(first[0].options, source.modifiers[0].options)
  assert.notEqual(first[0].options[0], source.modifiers[0].options[0])
  assert.equal(first[0].id, source.modifiers[0].id)
  assert.equal(first[0].options[0].id, source.modifiers[0].options[0].id)
  first[0].name = 'Fanta size'
  first[0].multi = true
  first[0].options[1].name = 'Fanta large'
  first[0].options[1].price = 275
  first[0].options.push({ id: 'new', name: 'Extra large', price: 400 })
  assert.equal(JSON.stringify(source), snapshot)
  assert.deepEqual(plain(second), plain(source.modifiers))
  assert.deepEqual(plain(cloneModifierGroups()), [])
})

console.log(`${passed} modifier auto-fill checks passed.`)
