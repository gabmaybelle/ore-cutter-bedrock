// Unit tests for the pack files: the manifest agrees with package.json, and the recipes are the
// ones the add-on promises. The ores and their blocks are written out here, not read from the
// pack, so a lost or changed recipe fails.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const pkg = read('package.json');
const manifest = read('packs/bp/manifest.json');

// Ore -> the blocks that craft its deepslate ore (with one deepslate), and the single piece that must not.
const ORES = {
	coal: [['coal_block'], 'coal'], copper: [['raw_copper_block', 'copper_block'], 'raw_copper'],
	iron: [['raw_iron_block', 'iron_block'], 'raw_iron'], gold: [['raw_gold_block', 'gold_block'], 'raw_gold'],
	redstone: [['redstone_block'], 'redstone'], emerald: [['emerald_block'], 'emerald'],
	lapis: [['lapis_block'], 'lapis_lazuli'], diamond: [['diamond_block'], 'diamond'],
};
const dir = path.join(root, 'packs', 'bp', 'recipes');
const recipes = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...read('packs/bp/recipes/' + f)['minecraft:recipe_shapeless'] }));
const items = (r) => r.ingredients.map((i) => i.item.replace('minecraft:', '')).sort();
const find = (tag, ingredients) => recipes.filter((r) => r.tags.includes(tag) && JSON.stringify(items(r)) === JSON.stringify([...ingredients].sort()));

test('the manifest: a data-only behaviour pack whose version is the package version', () => {
	assert.strictEqual(manifest.format_version, 2);
	assert.deepStrictEqual(manifest.modules.map((m) => m.type), ['data']);
	assert.notStrictEqual(manifest.header.uuid, manifest.modules[0].uuid);
	assert.deepStrictEqual(manifest.header.version, pkg.version.split('.').map(Number));
	assert.ok(fs.existsSync(path.join(root, 'packs/bp/pack_icon.png')), 'the pack has its icon');
});

test('every recipe: its own identifier, named as its file, one result, and something that unlocks it', () => {
	const ids = recipes.map((r) => r.description.identifier);
	assert.strictEqual(new Set(ids).size, ids.length);
	for (const r of recipes) {
		assert.strictEqual(r.description.identifier, 'orecutter:' + r.file.replace('.json', ''));
		assert.ok(!r.result.count || r.result.count === 1, `${r.file} gives one block`);
		assert.ok(r.unlock.length, `${r.file} says what unlocks it`);
	}
});

test('the stonecutter swaps each ore with its deepslate twin, both ways, one for one', () => {
	for (const ore of Object.keys(ORES)) {
		const [down] = find('stonecutter', [`${ore}_ore`]), [up] = find('stonecutter', [`deepslate_${ore}_ore`]);
		assert.ok(down && up, `${ore}: both stonecutter recipes exist`);
		assert.strictEqual(down.result.item, `minecraft:deepslate_${ore}_ore`);
		assert.strictEqual(up.result.item, `minecraft:${ore}_ore`);
	}
	assert.strictEqual(recipes.filter((r) => r.tags.includes('stonecutter')).length, Object.keys(ORES).length * 2);
});

test('each deepslate ore is crafted from a whole block and a deepslate, never from a single piece', () => {
	let crafting = 0;
	for (const [ore, [blocks, piece]] of Object.entries(ORES)) {
		for (const block of blocks) {
			const found = find('crafting_table', [block, 'deepslate']);
			assert.strictEqual(found.length, 1, `${block} and deepslate: one recipe`);
			assert.strictEqual(found[0].result.item, `minecraft:deepslate_${ore}_ore`);
			assert.ok(found[0].ingredients.every((i) => !i.count || i.count === 1), 'one of each');
			crafting++;
		}
		assert.strictEqual(find('crafting_table', [piece, 'deepslate']).length, 0, `a single ${piece} is not enough`);
	}
	assert.strictEqual(recipes.filter((r) => r.tags.includes('crafting_table')).length, crafting);
	assert.strictEqual(recipes.length, crafting + Object.keys(ORES).length * 2, 'no other recipes');
});
