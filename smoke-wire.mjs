/* Wire smoke test: exercises the real server protocol over two sockets. */
import WebSocket from 'ws';

const BASE = process.env.BASE ?? 'http://localhost:3210';
const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const created = await fetch(`${BASE}/api/rooms`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ game: 'minesweeper' })
}).then((r) => r.json());
if (!created.code) fail('room create failed: ' + JSON.stringify(created));
console.log('room', created.code);

function connect(token) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws');
  const inbox = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  const joined = new Promise((resolve, reject) => {
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', code: created.code, name: 'X', avatar: '🦊', token })));
    setTimeout(() => {
      const welcome = inbox.find((m) => m.t === 'welcome');
      welcome ? resolve(welcome) : reject(new Error('no welcome'));
    }, 300);
  });
  const send = (m) => ws.send(JSON.stringify(m));
  const drain = () => inbox.splice(0, inbox.length);
  const waitFor = async (pred, ms = 1500) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const hit = inbox.find(pred);
      if (hit) return hit;
      await sleep(25);
    }
    return null;
  };
  return { ws, joined, send, drain, waitFor, inbox };
}

const host = connect(created.token);
const hostWelcome = await host.joined;
const hostId = hostWelcome.you.id;
const guest = connect();
await guest.joined;
if (hostId.length !== 8) fail(`player id length ${hostId.length}, expected 8`);
console.log('ids are short:', hostId);

// --- minesweeper: reveal delta + slim cursor ---
host.send({ t: 'start' });
await host.waitFor((m) => m.t === "room" && m.room.status === "playing" && m.room.round, 4000);
guest.drain();
host.send({ t: 'cursor', x: 0.5, y: 0.25 });
const cursor = await guest.waitFor((m) => m.t === 'cursor');
if (!cursor) fail('no cursor message');
if ('name' in cursor || 'color' in cursor || 'avatar' in cursor)
  fail('cursor message still carries identity fields: ' + JSON.stringify(cursor));
console.log('cursor wire:', JSON.stringify(cursor));

host.send({ t: 'reveal', i: 40 });
const cells = await guest.waitFor((m) => m.t === 'cells');
if (!cells || !Array.isArray(cells.cells)) fail('no cells delta');
console.log('reveal delta:', JSON.stringify(cells).slice(0, 90));

// --- klondike: incremental moves, result sent once ---
host.send({ t: 'lobby' });
await host.waitFor((m) => m.t === 'room' && m.room.status === 'lobby');
host.send({
  t: 'settings', game: 'klondike', preset: 'cozy', lives: 2, maxPlayers: 8,
  lateJoin: true, sudokuDifficulty: 'medium', klondikeDraw: 1, mahjongLayout: 'turtle'
});
await host.waitFor((m) => m.t === 'room' && m.room.settings?.game === 'klondike');
host.send({ t: 'start' });
await host.waitFor((m) => m.t === 'room' && m.room.solitaire, 4000);
guest.drain();
host.send({ t: 'solitaire', action: 'draw' });
const sol = await guest.waitFor((m) => m.t === 'solitaireMove');
if (!sol || !Array.isArray(sol.moves)) fail('no solitaireMove');
if (guest.inbox.some((m) => m.t === 'room')) fail('full room broadcast during solitaire play');
console.log('solitaireMove:', JSON.stringify(sol).slice(0, 140));

// force the round to end, then check result-then-omit behaviour
host.send({ t: 'lobby' });
await host.waitFor((m) => m.t === 'room' && m.room.status === 'lobby');
host.send({
  t: 'settings', game: 'minesweeper', preset: 'cozy', lives: 1, maxPlayers: 8,
  lateJoin: true, sudokuDifficulty: 'medium', klondikeDraw: 1, mahjongLayout: 'turtle'
});
await host.waitFor((m) => m.t === "room" && m.room.settings.lives === 1);
host.send({ t: 'start' });
await host.waitFor((m) => m.t === "room" && m.room.status === "playing" && m.room.settings.lives === 1, 4000);
host.drain();
host.send({ t: 'reveal', i: 40 });
await sleep(120);
// find a mine via the host's own game: reveal cells until the round ends
for (let i = 0; i < 81; i += 1) {
  const done = guest.inbox.find((m) => m.t === 'room' && m.room.status === 'results');
  if (done) break;
  host.send({ t: 'reveal', i });
  await sleep(65);
}
const endRoom = await guest.waitFor((m) => m.t === 'room' && m.room.status === 'results');
if (!endRoom?.room?.lastResult) fail('result missing from the end broadcast');
console.log('result delivered on end broadcast:', endRoom.room.lastResult.result);
guest.drain();
host.send({ t: 'profile', name: 'Maya', avatar: '🦊' });
const after = await guest.waitFor((m) => m.t === 'room' && m.room.status === 'results');
if (!after) fail('no room broadcast for profile change');
if (after.room.lastResult !== undefined) fail('lastResult re-sent on a routine broadcast');
console.log('later broadcast omitted lastResult ✓');

// --- mahjong: select delta ---
await sleep(300);
host.send({ t: 'lobby' });
await host.waitFor((m) => m.t === 'room' && m.room.status === 'lobby');
host.send({
  t: 'settings', game: 'mahjong', preset: 'cozy', lives: 2, maxPlayers: 8,
  lateJoin: true, sudokuDifficulty: 'medium', klondikeDraw: 1, mahjongLayout: 'cozy'
});
await host.waitFor((m) => m.t === 'room' && m.room.settings?.game === 'mahjong');
host.send({ t: 'start' });
const mahjongRoom = await host.waitFor((m) => m.t === "room" && m.room.mahjong, 4000);
if (!mahjongRoom) fail('no mahjong state');
host.send({ t: 'mahjong', action: 'select', i: 0 });
const sel = await guest.waitFor((m) => m.t === 'mahjongSelect');
if (!sel) fail('no mahjongSelect message');
if (JSON.stringify(sel).length > 80) fail('mahjongSelect too big: ' + JSON.stringify(sel));
console.log('mahjongSelect:', JSON.stringify(sel));

// --- disconnect leave-cursor + resume with token ---
guest.drain();
host.ws.close();
const leave = await guest.waitFor((m) => m.t === 'cursor' && m.leave === true);
if (!leave) fail('no slim leave-cursor on disconnect');
console.log('leave cursor:', JSON.stringify(leave));

const host2 = connect(created.token);
const rejoin = await host2.joined;
if (!rejoin.room || rejoin.room.code !== created.code) fail('resume did not return the room');
console.log('rejoin with token resumed room, status', rejoin.room.status);

console.log('\nALL WIRE CHECKS PASSED');
process.exit(0);
