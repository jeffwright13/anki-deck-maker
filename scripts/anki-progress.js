const fs = require('fs');
const path = require('path');
const os = require('os');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('-')) {
      args._.push(a);
      continue;
    }

    const [key, maybeValue] = a.startsWith('--') ? a.slice(2).split('=', 2) : [a.slice(1), undefined];
    const normalizedKey = key;

    if (maybeValue !== undefined) {
      args[normalizedKey] = maybeValue;
      continue;
    }

    const next = argv[i + 1];
    const nextIsValue = next !== undefined && !next.startsWith('-');

    if (nextIsValue) {
      args[normalizedKey] = next;
      i++;
    } else {
      args[normalizedKey] = true;
    }
  }
  return args;
}

function showHelp() {
  console.log(`\nAnki progress helper (snapshot/restore scheduling)\n\nUsage:\n  node scripts/anki-progress.js snapshot [options]\n  node scripts/anki-progress.js restore  [options]\n  node scripts/anki-progress.js list-decks [options]\n\nOptions:\n  --profile <name>           Anki profile folder name (default: User 1)\n  --collection <path>        Path to collection.anki2 (overrides --profile)\n\nSelection (optional):\n  --deck <deck name>         Deck name prefix (matches deck and all children)\n  --note-type <model name>   Filter by note type name\n  --tag <tag>                Filter by tag (exact tag token)\n\nUID handling:\n  --uid-field <n>            Which field index to use as UID (default: 0)\n\nsnapshot options:\n  --out <file>               Output JSON snapshot path (default: ./debug/anki-progress-snapshot.json)\n\nrestore options:\n  --in <file>                Input JSON snapshot path\n  --dry-run                  Report changes but do not write to DB\n  --no-backup                Do not create a .bak copy of collection.anki2\n\nNotes:\n- Quit Anki before running restore.\n- This tool overwrites scheduling fields in the cards table for matched cards.\n`);
}

function defaultCollectionPath(profileName) {
  return path.join(os.homedir(), 'Library', 'Application Support', 'Anki2', profileName, 'collection.anki2');
}

function loadCollectionBuffer(collectionPath) {
  if (!fs.existsSync(collectionPath)) {
    throw new Error(`collection.anki2 not found at: ${collectionPath}`);
  }
  return fs.readFileSync(collectionPath);
}

async function openSqlJsDatabaseFromFile(collectionPath) {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const buf = loadCollectionBuffer(collectionPath);
  return { SQL, db: new SQL.Database(buf) };
}

function readColJson(db, columnName) {
  const res = db.exec(`SELECT ${columnName} FROM col LIMIT 1`);
  if (!res[0] || !res[0].values || !res[0].values[0]) {
    throw new Error(`Failed to read col.${columnName}`);
  }
  const text = res[0].values[0][0];
  return JSON.parse(text);
}

function getDeckIdsByPrefix(decksJson, deckPrefix) {
  const prefix = deckPrefix;
  const prefixWithSep = `${deckPrefix}::`;

  const dids = [];
  for (const deck of Object.values(decksJson)) {
    if (!deck || !deck.name) continue;
    if (deck.name === prefix || deck.name.startsWith(prefixWithSep)) {
      dids.push(Number(deck.id));
    }
  }
  return dids;
}

function getModelIdsByName(modelsJson, modelName) {
  const mids = [];
  for (const [mid, model] of Object.entries(modelsJson)) {
    if (model?.name === modelName) mids.push(Number(mid));
  }
  return mids;
}

function splitFields(flds) {
  return String(flds || '').split('\u001f');
}

function hasTag(tagsText, tag) {
  const tags = String(tagsText || '').trim().split(/\s+/).filter(Boolean);
  return tags.includes(tag);
}

function queryCardsWithNotes(db, { dids, mids }) {
  const where = [];
  if (dids && dids.length > 0) where.push(`c.did IN (${dids.join(',')})`);
  if (mids && mids.length > 0) where.push(`n.mid IN (${mids.join(',')})`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // We fetch note tags and fields, and filter tag in JS to avoid SQL LIKE pitfalls.
  return db.exec(`
    SELECT
      c.id AS cid,
      c.nid AS nid,
      c.did AS did,
      c.ord AS ord,
      c.type AS type,
      c.queue AS queue,
      c.due AS due,
      c.ivl AS ivl,
      c.factor AS factor,
      c.reps AS reps,
      c.lapses AS lapses,
      c.left AS left,
      c.odue AS odue,
      c.odid AS odid,
      c.flags AS flags,
      c.data AS data,
      n.flds AS flds,
      n.tags AS ntags,
      n.mid AS mid
    FROM cards c
    JOIN notes n ON n.id = c.nid
    ${whereSql}
  `);
}

function rowsFromExec(execResult) {
  if (!execResult || execResult.length === 0) return [];
  const { columns, values } = execResult[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

function makeSnapshotKey(uid, ord) {
  return `${uid}::ord=${ord}`;
}

function writeSnapshot(outPath, snapshot) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
}

function backupFile(filePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak-${stamp}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function saveDatabaseToFile(db, outPath) {
  const data = db.export();
  fs.writeFileSync(outPath, Buffer.from(data));
}

async function cmdListDecks(options) {
  const { db } = await openSqlJsDatabaseFromFile(options.collectionPath);
  const decksJson = readColJson(db, 'decks');
  const names = Object.values(decksJson)
    .map(d => d?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  names.forEach(n => console.log(n));
}

async function cmdSnapshot(options) {
  const { db } = await openSqlJsDatabaseFromFile(options.collectionPath);
  const decksJson = readColJson(db, 'decks');
  const modelsJson = readColJson(db, 'models');

  const dids = options.deck ? getDeckIdsByPrefix(decksJson, options.deck) : null;
  const mids = options.noteType ? getModelIdsByName(modelsJson, options.noteType) : null;

  const execResult = queryCardsWithNotes(db, { dids, mids });
  const rows = rowsFromExec(execResult);

  const uidFieldIndex = options.uidFieldIndex;

  const snapshot = {
    meta: {
      createdAt: new Date().toISOString(),
      profile: options.profileName,
      collectionPath: options.collectionPath,
      deck: options.deck || null,
      noteType: options.noteType || null,
      tag: options.tag || null,
      uidField: uidFieldIndex
    },
    cards: {},
    counts: {
      totalRows: rows.length,
      matchedCards: 0,
      skippedMissingUid: 0,
      skippedTagFilter: 0
    }
  };

  for (const r of rows) {
    if (options.tag && !hasTag(r.ntags, options.tag)) {
      snapshot.counts.skippedTagFilter++;
      continue;
    }

    const fields = splitFields(r.flds);
    const uid = fields[uidFieldIndex];
    if (!uid) {
      snapshot.counts.skippedMissingUid++;
      continue;
    }

    const key = makeSnapshotKey(uid, Number(r.ord));
    snapshot.cards[key] = {
      type: Number(r.type),
      queue: Number(r.queue),
      due: Number(r.due),
      ivl: Number(r.ivl),
      factor: Number(r.factor),
      reps: Number(r.reps),
      lapses: Number(r.lapses),
      left: Number(r.left),
      odue: Number(r.odue),
      odid: Number(r.odid),
      flags: Number(r.flags),
      data: r.data == null ? '' : String(r.data)
    };
    snapshot.counts.matchedCards++;
  }

  writeSnapshot(options.outPath, snapshot);
  console.log(`✅ Snapshot saved: ${options.outPath}`);
  console.log(`   matchedCards=${snapshot.counts.matchedCards} (from ${snapshot.counts.totalRows} cards scanned)`);
}

async function cmdRestore(options) {
  if (!options.inPath) throw new Error('Missing --in <snapshot.json>');
  if (!fs.existsSync(options.inPath)) throw new Error(`Snapshot file not found: ${options.inPath}`);

  const snapshot = JSON.parse(fs.readFileSync(options.inPath, 'utf-8'));
  const snapshotCards = snapshot.cards || {};

  const { db } = await openSqlJsDatabaseFromFile(options.collectionPath);
  const decksJson = readColJson(db, 'decks');
  const modelsJson = readColJson(db, 'models');

  const dids = options.deck ? getDeckIdsByPrefix(decksJson, options.deck) : null;
  const mids = options.noteType ? getModelIdsByName(modelsJson, options.noteType) : null;

  const execResult = queryCardsWithNotes(db, { dids, mids });
  const rows = rowsFromExec(execResult);

  const uidFieldIndex = options.uidFieldIndex;
  const nowSec = Math.floor(Date.now() / 1000);

  let scanned = 0;
  let eligible = 0;
  let matched = 0;
  let missing = 0;
  let skippedMissingUid = 0;
  let skippedTagFilter = 0;

  // Prepare UPDATE statement
  const updateStmt = db.prepare(`
    UPDATE cards
    SET
      mod = ?,
      usn = -1,
      type = ?,
      queue = ?,
      due = ?,
      ivl = ?,
      factor = ?,
      reps = ?,
      lapses = ?,
      left = ?,
      odue = ?,
      odid = ?,
      flags = ?,
      data = ?
    WHERE id = ?
  `);

  const changes = [];

  for (const r of rows) {
    scanned++;
    if (options.tag && !hasTag(r.ntags, options.tag)) {
      skippedTagFilter++;
      continue;
    }

    const fields = splitFields(r.flds);
    const uid = fields[uidFieldIndex];
    if (!uid) {
      skippedMissingUid++;
      continue;
    }

    eligible++;
    const key = makeSnapshotKey(uid, Number(r.ord));
    const snap = snapshotCards[key];
    if (!snap) {
      missing++;
      continue;
    }

    matched++;

    if (options.dryRun) {
      changes.push({ cid: Number(r.cid), key });
      continue;
    }

    updateStmt.run([
      nowSec,
      snap.type,
      snap.queue,
      snap.due,
      snap.ivl,
      snap.factor,
      snap.reps,
      snap.lapses,
      snap.left,
      snap.odue,
      snap.odid,
      snap.flags,
      snap.data,
      Number(r.cid)
    ]);
  }

  updateStmt.free();

  console.log(`📌 Restore scan results:`);
  console.log(`   scannedCards=${scanned}`);
  console.log(`   eligibleCards=${eligible}`);
  console.log(`   matchedCards=${matched}`);
  console.log(`   missingInSnapshot=${missing}`);
  console.log(`   skippedMissingUid=${skippedMissingUid}`);
  console.log(`   skippedTagFilter=${skippedTagFilter}`);

  if (options.dryRun) {
    console.log(`🧪 Dry-run: no changes written.`);
    console.log(`   Example matches:`);
    changes.slice(0, 10).forEach(c => console.log(`   - cid=${c.cid} ${c.key}`));
    return;
  }

  if (!options.noBackup) {
    const backupPath = backupFile(options.collectionPath);
    console.log(`🛟 Backup created: ${backupPath}`);
  }

  saveDatabaseToFile(db, options.collectionPath);
  console.log(`✅ Scheduling restored and saved to: ${options.collectionPath}`);
}

async function main() {
  const args = parseArgs(process.argv);

  const command = (args._[0] || '').toLowerCase();
  if (!command || args.help || args.h) {
    showHelp();
    process.exit(command ? 0 : 1);
  }

  const profileName = args.profile || 'User 1';
  const collectionPath = args.collection || defaultCollectionPath(profileName);

  const uidFieldIndex = args['uid-field'] !== undefined ? Number(args['uid-field']) : 0;
  if (!Number.isFinite(uidFieldIndex) || uidFieldIndex < 0) {
    throw new Error(`Invalid --uid-field: ${args['uid-field']}`);
  }

  const options = {
    profileName,
    collectionPath,
    deck: args.deck || null,
    noteType: args['note-type'] || null,
    tag: args.tag || null,
    uidFieldIndex,
    outPath: args.out || path.join(__dirname, '..', 'debug', 'anki-progress-snapshot.json'),
    inPath: args.in || null,
    dryRun: Boolean(args['dry-run']),
    noBackup: Boolean(args['no-backup'])
  };

  if (command === 'list-decks') {
    await cmdListDecks(options);
    return;
  }

  if (command === 'snapshot') {
    await cmdSnapshot(options);
    return;
  }

  if (command === 'restore') {
    await cmdRestore(options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
