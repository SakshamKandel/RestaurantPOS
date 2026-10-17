// Run with: node scripts/menu-modifier-autofill-test.cjs
// Exercise actual TSX callbacks and the real modifier editor without Electron,
// a browser, persistent state, or a database. React hooks are isolated per host.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const React = require('react')

const sourceRoot = path.resolve(__dirname, '../src')
const loaded = new Map()
let activeFrame
const mockReact = {
  ...React,
  useState(initial) {
    assert.ok(activeFrame, 'Hooks must run inside an isolated component host')
    const frame = activeFrame
    const index = frame.cursor++
    if (!(index in frame.state)) frame.state[index] = typeof initial === 'function' ? initial() : initial
    return [frame.state[index], (next) => {
      frame.state[index] = typeof next === 'function' ? next(frame.state[index]) : next
    }]
  },
}

function load(relative) {
  const file = path.resolve(sourceRoot, relative)
  if (loaded.has(file)) return loaded.get(file).exports
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const entry = { exports: {} }
  loaded.set(file, entry)
  const localRequire = createRequire(file)
  const requireSource = (name) => {
    if (name === 'react') return mockReact
    if (!name.startsWith('.')) return localRequire(name)
    const base = path.resolve(path.dirname(file), name)
    if (base === path.join(sourceRoot, 'store')) {
      return { pickImage: () => { throw new Error('Image picking must not run in this regression test') } }
    }
    const dependency = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate))
    assert.ok(dependency, `Expected production dependency ${name}`)
    return load(path.relative(sourceRoot, dependency))
  }
  vm.runInNewContext(output.outputText, {
    module: entry, exports: entry.exports, require: requireSource,
  }, { filename: file })
  return entry.exports
}

const MenuPage = load('pages/MenuPage.tsx').default
const ItemModifiersModal = load('components/ItemModifiersModal.tsx').default
const ModifierGroupsEditor = load('components/ModifierGroupsEditor.tsx').default
const same = (actual, expected, message) => assert.deepEqual(structuredClone(actual), structuredClone(expected), message)
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function host(Component, initialProps) {
  const frame = { state: [], cursor: 0 }
  let props = initialProps
  let expectedHooks
  return {
    setProps(next) { props = next },
    render() {
      const previous = activeFrame
      activeFrame = frame
      frame.cursor = 0
      try {
        const result = Component(props)
        if (expectedHooks === undefined) expectedHooks = frame.cursor
        assert.equal(frame.cursor, expectedHooks, 'Each render must preserve React hook order')
        return result
      } finally {
        activeFrame = previous
      }
    },
  }
}

function find(tree, predicate) {
  const result = []
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!React.isValidElement(node)) return
    if (predicate(node)) result.push(node)
    visit(node.props.children)
  }
  visit(tree)
  return result
}
function one(tree, predicate, label) {
  const matches = find(tree, predicate)
  assert.equal(matches.length, 1, `Expected exactly one ${label}; found ${matches.length}`)
  return matches[0]
}
function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (React.isValidElement(node)) return text(node.props.children)
  return String(node)
}
const button = (tree, label) => one(tree, (node) => node.type === 'button' && text(node).trim() === label, `${label} button`)
const labelled = (tree, type, label) => one(tree, (node) => node.type === type && node.props['aria-label'] === label, label)
const placeholder = (tree, label) => one(tree, (node) => node.type === 'input' && node.props.placeholder === label, label)
const click = (node) => {
  assert.ok(!node.props.disabled, 'Cannot activate a disabled control')
  node.props.onClick()
}
const change = (node, value) => node.props.onChange({ target: { value } })
const editorElement = (tree) => one(tree, (node) => node.type === ModifierGroupsEditor, 'production modifier editor')
const groups = (component) => editorElement(component.render()).props.groups
function copySelect(tree) {
  const label = one(tree, (node) => node.type === 'label' && text(node).trim().startsWith('Copy modifiers from'), 'copy source label')
  return one(label, (node) => node.type === 'select', 'copy source select')
}

function editorFor(parent) {
  let currentKey
  let editor
  return {
    render() {
      const element = editorElement(parent.render())
      if (!editor || currentKey !== element.key) {
        currentKey = element.key
        editor = host(ModifierGroupsEditor, element.props)
      } else editor.setProps(element.props)
      return editor.render()
    },
  }
}

const drinksGroups = [{
  id: 'size', name: 'Size', required: true, multi: false,
  options: [{ id: 'regular', name: 'Regular', price: 0 }, { id: 'large', name: 'Large', price: 150 }],
}]
const mealsGroups = [{
  id: 'extras', name: 'Extras', required: false, multi: true,
  options: [{ id: 'cheese', name: 'Cheese', price: 75 }, { id: 'sauce', name: 'Sauce', price: 50 }],
}]
const item = (id, name, category, modifiers) => ({ id, name, category, modifiers, price: 250, available: true, image: '', emoji: '🥤' })
const categories = freeze([{ id: 'drinks', label: 'Drinks', icon: 'beverages' }, { id: 'meals', label: 'Meals', icon: 'sandwich' }])
const fixture = ({ ambiguous = false, existing = false } = {}) => {
  const menu = [item('coke', 'Coca Cola', 'drinks', structuredClone(drinksGroups)), item('burger', 'Burger', 'meals', structuredClone(mealsGroups))]
  if (ambiguous) menu.push(item('tea', 'Iced Tea', 'drinks', structuredClone(mealsGroups)))
  if (existing) menu.push(item('fanta', 'Fanta', 'drinks', []))
  return freeze(menu)
}
function page(menu = fixture()) {
  const saves = []
  const component = host(MenuPage, {
    menu, categories, taxClasses: [], onSave: (saved) => saves.push(saved),
    onDelete() { assert.fail('Delete must not run') }, onToggle() { assert.fail('Availability toggle must not run') },
    onSaveCategory() { assert.fail('Category save must not run') }, onDeleteCategory() { assert.fail('Category delete must not run') },
  })
  return { ...component, saves, menu }
}
function startNew(component, name = 'Fanta') {
  click(button(component.render(), 'Add Item'))
  change(placeholder(component.render(), 'Item name'), name)
  change(placeholder(component.render(), 'Price (e.g. 9.50)'), '3.50')
}
function setCategory(component, category) {
  change(labelled(component.render(), 'select', 'Item category'), category)
}
function modalFor(component, itemName = 'Fanta') {
  click(labelled(component.render(), 'button', `Modifiers for ${itemName}`))
  const modal = host(ItemModifiersModal, {})
  return {
    render() {
      const element = one(component.render(), (node) => node.type === ItemModifiersModal, 'production item modifiers modal')
      modal.setProps(element.props)
      return modal.render()
    },
  }
}

let passed = 0
function test(name, run) {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

test('new Fanta automatically displays and saves a private copy of Coca Cola modifiers', () => {
  const component = page()
  const original = structuredClone(component.menu)
  click(button(component.render(), 'Add Item'))
  same(groups(component), [], 'Unnamed drafts must not acquire unrelated settings')
  change(placeholder(component.render(), 'Item name'), 'Fanta')
  change(placeholder(component.render(), 'Price (e.g. 9.50)'), '3.50')
  same(groups(component), drinksGroups)
  assert.ok(text(component.render()).includes('Auto-filled from Coca Cola'))
  assert.equal(component.saves.length, 0, 'Suggestion must not save before Add to Menu')
  click(button(component.render(), 'Add to Menu'))
  assert.equal(component.saves.length, 1)
  assert.equal(component.saves[0].name, 'Fanta')
  assert.equal(component.saves[0].category, 'drinks')
  assert.equal(component.saves[0].price, 350)
  same(component.saves[0].modifiers, drinksGroups)
  component.saves[0].modifiers[0].options[1].price = 900
  same(component.menu, original, 'Saved options must not share source references')
})

test('untouched automatic suggestions follow category and name changes', () => {
  const component = page()
  startNew(component)
  same(groups(component), drinksGroups)
  setCategory(component, 'meals')
  same(groups(component), mealsGroups)
  assert.ok(text(component.render()).includes('Auto-filled from Burger'))
  change(placeholder(component.render(), 'Item name'), 'Sprite')
  setCategory(component, 'drinks')
  same(groups(component), drinksGroups)
  click(button(component.render(), 'Add to Menu'))
  same(component.saves[0].modifiers, drinksGroups)
})

test('editing real option controls freezes the draft through name and category changes', () => {
  const component = page()
  startNew(component)
  const editor = editorFor(component)
  const editorKey = editorElement(component.render()).key
  change(labelled(editor.render(), 'input', 'Option 2 name in Size'), 'Fanta bottle')
  assert.equal(editorElement(component.render()).key, editorKey, 'First manual edit must preserve the mounted editor and focus')
  change(labelled(editor.render(), 'input', 'Extra price for Fanta bottle'), '2.25')
  const edited = structuredClone(groups(component))
  assert.equal(edited[0].options[1].price, 225)
  assert.equal(component.menu[0].modifiers[0].options[1].name, 'Large')
  change(placeholder(component.render(), 'Item name'), 'Custom Fanta')
  setCategory(component, 'meals')
  same(groups(component), edited, 'Manual settings must not be overwritten by another category')
  click(button(component.render(), 'Add to Menu'))
  same(component.saves[0].modifiers, edited)
  same(component.menu[0].modifiers, drinksGroups)
})

test('Start empty opts out of later suggestions and saves an empty modifier list', () => {
  const component = page()
  startNew(component)
  click(button(component.render(), 'Start empty'))
  change(placeholder(component.render(), 'Item name'), 'No Extras Drink')
  setCategory(component, 'meals')
  setCategory(component, 'drinks')
  same(groups(component), [])
  click(button(component.render(), 'Add to Menu'))
  same(component.saves[0].modifiers, [])
  same(component.menu[0].modifiers, drinksGroups)
})

test('existing item edits preserve their own empty or populated modifier settings', () => {
  for (const name of ['Fanta', 'Coca Cola']) {
    const component = page(fixture({ existing: true }))
    const expected = name === 'Fanta' ? [] : drinksGroups
    click(labelled(component.render(), 'button', `Edit ${name}`))
    same(groups(component), expected)
    assert.equal(find(component.render(), (node) => node.type === 'input' && node.props.type === 'checkbox').length, 0,
      'Existing item edit must not enable automatic matching')
    change(placeholder(component.render(), 'Item name'), `${name} revised`)
    setCategory(component, 'meals')
    same(groups(component), expected)
    click(button(component.render(), 'Save Changes'))
    same(component.saves[0].modifiers, expected)
  }
})

test('closing a new draft discards automatic and manual changes without saving', () => {
  const component = page()
  startNew(component)
  change(labelled(editorFor(component).render(), 'input', 'Option 2 name in Size'), 'Unsaved name')
  const dialog = one(component.render(), (node) => node.type === 'div' && node.props.className?.includes('fixed inset-0'), 'new-item overlay')
  click(one(dialog, (node) => node.type === 'button' && text(node).trim() === '', 'close draft button'))
  assert.equal(component.saves.length, 0)
  startNew(component)
  same(groups(component), drinksGroups, 'Reopening must start with a fresh suggestion')
})

test('conflicting category setups require an explicit source choice', () => {
  const component = page(fixture({ ambiguous: true }))
  startNew(component)
  same(groups(component), [])
  assert.ok(text(component.render()).includes('Different modifier setups found'))
  change(copySelect(component.render()), 'tea')
  same(groups(component), mealsGroups)
  assert.ok(text(component.render()).includes('Copied from Iced Tea'))
  change(placeholder(component.render(), 'Item name'), 'Other Drink')
  setCategory(component, 'meals')
  setCategory(component, 'drinks')
  same(groups(component), mealsGroups)
  click(button(component.render(), 'Add to Menu'))
  same(component.saves[0].modifiers, mealsGroups)
  same(component.menu.find((entry) => entry.id === 'tea').modifiers, mealsGroups)
})

test('automatic-fill checkbox preserves a disabled copy and can resume suggestions', () => {
  const component = page()
  startNew(component)
  const autoCheckbox = () => one(component.render(), (node) => node.type === 'input' && node.props.type === 'checkbox', 'automatic-fill checkbox')
  autoCheckbox().props.onChange({ target: { checked: false } })
  setCategory(component, 'meals')
  same(groups(component), drinksGroups)
  autoCheckbox().props.onChange({ target: { checked: true } })
  same(groups(component), mealsGroups)
})

test('existing empty-item Auto-fill is a draft until Save modifiers updates that item', () => {
  const component = page(fixture({ existing: true }))
  const original = structuredClone(component.menu)
  const modal = modalFor(component)
  same(groups(modal), [])
  click(button(modal.render(), 'Auto-fill from Coca Cola'))
  same(groups(modal), drinksGroups)
  assert.equal(component.saves.length, 0)
  assert.ok(text(modal.render()).includes('Copied from Coca Cola'))
  const editorKey = editorElement(modal.render()).key
  change(labelled(editorFor(modal).render(), 'input', 'Option 2 name in Size'), 'Fanta large')
  assert.equal(editorElement(modal.render()).key, editorKey, 'Normal modal edits must preserve the mounted editor and focus')
  click(button(modal.render(), 'Save modifiers'))
  assert.equal(component.saves.length, 1)
  assert.equal(component.saves[0].id, 'fanta')
  assert.equal(component.saves[0].price, 250)
  assert.equal(component.saves[0].modifiers[0].options[1].name, 'Fanta large')
  same(component.menu, original)
  assert.equal(find(component.render(), (node) => node.type === ItemModifiersModal).length, 0, 'Save must close the item modal')
})

test('Cancel discards existing-item Auto-fill without changing either menu item', () => {
  const component = page(fixture({ existing: true }))
  const original = structuredClone(component.menu)
  let modal = modalFor(component)
  click(button(modal.render(), 'Auto-fill from Coca Cola'))
  change(labelled(editorFor(modal).render(), 'input', 'Extra price for Large'), '9.99')
  click(button(modal.render(), 'Cancel'))
  assert.equal(component.saves.length, 0)
  same(component.menu, original)
  modal = modalFor(component)
  same(groups(modal), [], 'Cancelled copied settings must not survive reopening')
})

test('ambiguous existing-item modifiers support explicit source selection and cancellation', () => {
  const component = page(fixture({ existing: true, ambiguous: true }))
  let modal = modalFor(component)
  assert.equal(find(modal.render(), (node) => node.type === 'button' && text(node).startsWith('Auto-fill from')).length, 0)
  change(copySelect(modal.render()), 'tea')
  same(groups(modal), mealsGroups)
  click(button(modal.render(), 'Cancel'))
  assert.equal(component.saves.length, 0)
  modal = modalFor(component)
  change(copySelect(modal.render()), 'coke')
  click(button(modal.render(), 'Save modifiers'))
  same(component.saves[0].modifiers, drinksGroups)
})

test('existing populated-item Start empty stays empty until explicitly saved', () => {
  const component = page()
  const modal = modalFor(component, 'Coca Cola')
  same(groups(modal), drinksGroups)
  assert.equal(find(modal.render(), (node) => node.type === 'button' && text(node).startsWith('Auto-fill from')).length, 0)
  click(button(modal.render(), 'Start empty'))
  same(groups(modal), [])
  assert.equal(component.saves.length, 0)
  click(button(modal.render(), 'Save modifiers'))
  assert.equal(component.saves[0].id, 'coke')
  same(component.saves[0].modifiers, [])
  same(component.menu[0].modifiers, drinksGroups, 'Props remain untouched until the parent persists the saved item')
})

test('explicit recopy resets stale extra-price drafts while normal edits retain the editor', () => {
  for (const useModal of [false, true]) {
    const component = page(fixture({ existing: true }))
    let draft
    if (useModal) {
      draft = modalFor(component)
      click(button(draft.render(), 'Auto-fill from Coca Cola'))
    } else {
      startNew(component)
      draft = component
    }
    const editor = editorFor(draft)
    const originalKey = editorElement(draft.render()).key
    change(labelled(editor.render(), 'input', 'Extra price for Large'), '2.')
    assert.equal(labelled(editor.render(), 'input', 'Extra price for Large').props.value, '2.')
    assert.equal(editorElement(draft.render()).key, originalKey, 'Price editing must preserve the input draft and focus')
    change(copySelect(draft.render()), 'coke')
    assert.notEqual(editorElement(draft.render()).key, originalKey, 'Explicit recopy must replace editor draft state')
    assert.equal(labelled(editor.render(), 'input', 'Extra price for Large').props.value, '1.50')
    same(groups(draft), drinksGroups)
    const copiedKey = editorElement(draft.render()).key
    click(button(draft.render(), 'Start empty'))
    assert.notEqual(editorElement(draft.render()).key, copiedKey, 'Start empty must reset editor draft state')
    same(groups(draft), [])
  }
})

console.log(`${passed} menu modifier auto-fill integration checks passed.`)
