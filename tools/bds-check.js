#!/usr/bin/env node
// Headless check on Bedrock Dedicated Server: puts the built pack on a fresh flat world, starts the
// server with no window, lets it load, stops it and reads its log and content log. It proves the
// manifest and every recipe file load with no error or warning (an item name the game doesn't know
// shows up here). It can't craft anything: that needs a game.
//
//   node tools/bds-check.js <server folder> [--zip <bedrock-server-x.y.z.zip>] [--port 19270]
//
// Run `npm run build` first. Downloading and running the server means you accept Minecraft's EULA.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) { console.error('usage: node tools/bds-check.js <server folder> [--zip <server zip>] [--port N]'); process.exit(2); }
const folder = path.resolve(args[0]);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const zip = opt('--zip', null);
const port = parseInt(opt('--port', '19270'), 10);
const bp = path.join(root, 'build', 'packs', 'bp');
if (!fs.existsSync(path.join(bp, 'manifest.json'))) { console.error('no build: run npm run build first'); process.exit(2); }

const exe = path.join(folder, process.platform === 'win32' ? 'bedrock_server.exe' : 'bedrock_server');
if (!fs.existsSync(exe)) {
	if (!zip) { console.error('no server in the folder and no --zip given'); process.exit(2); }
	fs.mkdirSync(folder, { recursive: true });
	console.log('extracting', zip);
	if (process.platform === 'win32') cp.execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${folder}' -Force`], { stdio: 'inherit' });
	else cp.execFileSync('unzip', ['-q', '-o', zip, '-d', folder], { stdio: 'inherit' });
}

const dev = path.join(folder, 'development_behavior_packs', 'OreCutterBP');
fs.rmSync(dev, { recursive: true, force: true });
fs.cpSync(bp, dev, { recursive: true });
const header = JSON.parse(fs.readFileSync(path.join(bp, 'manifest.json'), 'utf8')).header;
const recipes = fs.readdirSync(path.join(bp, 'recipes')).filter((f) => f.endsWith('.json')).length;

const level = 'occheck';
const world = path.join(folder, 'worlds', level);
fs.rmSync(world, { recursive: true, force: true });
fs.mkdirSync(world, { recursive: true });
fs.writeFileSync(path.join(world, 'world_behavior_packs.json'), JSON.stringify([{ pack_id: header.uuid, version: header.version }], null, 2));

const propsPath = path.join(folder, 'server.properties');
let props = fs.readFileSync(propsPath, 'utf8');
const set = (k, v) => { const re = new RegExp(`^${k}=.*$`, 'm'); props = re.test(props) ? props.replace(re, `${k}=${v}`) : props + `\n${k}=${v}`; };
set('server-port', port); set('server-portv6', port + 1); set('level-name', level); set('level-type', 'FLAT');
set('gamemode', 'creative'); set('allow-cheats', 'true'); set('content-log-file-enabled', 'true');
set('content-log-console-output-enabled', 'true'); set('online-mode', 'false'); set('allow-list', 'false');
set('max-players', '2'); set('server-name', 'Ore Cutter check'); set('enable-lan-visibility', 'false');
fs.writeFileSync(propsPath, props);

console.log(`starting the server on port ${port}`);
const log = [];
const child = cp.spawn(exe, [], { cwd: folder, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
let started = false, stopped = false;
const stop = () => { if (stopped) return; stopped = true; try { child.stdin.write('stop\n'); } catch {} setTimeout(() => { try { child.kill(); } catch {} }, 15000); };
const onData = (d) => {
	const s = d.toString();
	log.push(s);
	process.stdout.write(s);
	// Recipes are read while the world loads; a few seconds after "Server started" everything has been logged.
	if (!started && /Server started/.test(log.join(''))) { started = true; setTimeout(stop, 8000); }
};
child.stdout.on('data', onData); child.stderr.on('data', onData);
const limit = setTimeout(stop, 180000);
child.on('exit', (code) => {
	clearTimeout(limit);
	const all = log.join('');
	let contentLog = '';
	const m = /Writing log to: (.+ContentLog[^\r\n]+\.txt)/.exec(all);
	if (m && fs.existsSync(m[1].trim())) contentLog = fs.readFileSync(m[1].trim(), 'utf8');
	console.log('content log: ' + (m ? m[1].trim() + ' (' + contentLog.split(/\r?\n/).filter(Boolean).length + ' lines)' : 'not written'));
	const both = all + '\n' + contentLog;
	const problems = [];
	const errLines = both.split(/\r?\n/).filter((l) => (/ (ERROR|WARN)\] /.test(l) || /\]\[(error|warning)\]/i.test(l) || /exception/i.test(l))
		&& !/errorMessage=\(null\)|Content logging to console/.test(l));
	if (!/Server started/.test(all)) problems.push('the server never said "Server started"');
	// The server names each pack a world uses as it loads it; without this line the pack was not applied.
	if (!new RegExp(header.uuid, 'i').test(both) && !/Ore Cutter/.test(both)) problems.push('the server log never names the Ore Cutter pack, so the world may not have used it');
	if (errLines.length) problems.push(`${errLines.length} error or warning line(s):\n  ` + errLines.join('\n  '));
	const version = (/Version:? ([\d.]+)/.exec(all) || [])[1] || '?';
	console.log('\n=== result ===');
	console.log(`server ${version}, exit code ${code}`);
	if (problems.length) { console.log('FAILED:\n- ' + problems.join('\n- ')); process.exit(1); }
	console.log(`ok: the pack and its ${recipes} recipes loaded with no error or warning lines in the console or the content log`);
});
