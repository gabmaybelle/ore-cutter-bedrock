#!/usr/bin/env node
// Builds the behaviour pack and the .mcaddon.
//
//   node tools/build.js
//
// The add-on is recipes only, so there is nothing to compile: the files in packs/bp are copied as
// they are, with the version from package.json written into the manifest. Output:
//   build/packs/bp                     the behaviour pack
//   dist/OreCutter-<version>.mcaddon   the file players open
'use strict';
const fs = require('fs'), path = require('path');
const { zip } = require('./zip.js');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const bp = path.join(root, 'build', 'packs', 'bp');
const fail = (why) => { console.error('build failed: ' + why); process.exit(1); };

fs.rmSync(path.join(root, 'build', 'packs'), { recursive: true, force: true });
fs.cpSync(path.join(root, 'packs', 'bp'), bp, { recursive: true });

const manifestPath = path.join(bp, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = pkg.version.split('.').map(Number);
manifest.header.version = version;
for (const mod of manifest.modules) mod.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');

if (!fs.existsSync(path.join(bp, 'pack_icon.png'))) fail('packs/bp/pack_icon.png is missing');
const recipes = fs.readdirSync(path.join(bp, 'recipes')).filter((f) => f.endsWith('.json'));
if (!recipes.length) fail('packs/bp/recipes is empty');

// The .mcaddon: the pack in a folder of its own, in a fixed order so the same files give the same zip.
const files = [];
(function walk(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1))) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p);
		else files.push({ name: 'OreCutter_BP/' + path.relative(bp, p).split(path.sep).join('/'), data: fs.readFileSync(p) });
	}
})(bp);
const addon = path.join(root, 'dist', `OreCutter-${pkg.version}.mcaddon`);
fs.mkdirSync(path.dirname(addon), { recursive: true });
fs.writeFileSync(addon, zip(files));
console.log(`built: ${path.relative(root, addon)} (${recipes.length} recipes, ${files.length} files, ${Math.round(fs.statSync(addon).size / 1024)} KB)`);
