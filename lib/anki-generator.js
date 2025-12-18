const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Anki .apkg generator for glossary cards
 * Based on DrillMaster's Anki generation logic
 */

class AnkiGenerator {
    constructor(options = {}) {
        this.mode = options.mode || 'glossary';
        this.noteTypeName = options.noteTypeName || (this.mode === 'cloze' ? 'Cloze' : 'JW::Spanish Glossary v1');
        this.noteTypeId = this.stableNumericId(this.noteTypeName, 2000000000);
        this.deckId = this.stableNumericId('JW::Vocabulary', 2100000000);
        this.nextDeckId = this.deckId + 1;
        this.nextNoteId = 1;
        this.nextCardId = 1;
    }

    stableNumericId(key, offset) {
        const hex = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 8);
        const n = parseInt(hex, 16);
        return offset + (n % 1000000000);
    }

    generateGuidFromUid(uid) {
        return crypto.createHash('sha1').update(String(uid)).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 16);
    }

    generateChecksum(data) {
        // Simple checksum for Anki
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data.charCodeAt(i);
        }
        return sum % 2147483647;
    }

    createNoteType() {
        if (this.mode === 'cloze') {
            return this.createClozeNoteType();
        }

        const noteType = {
            id: this.noteTypeId,
            name: this.noteTypeName,
            type: 0,
            mod: Math.floor(Date.now() / 1000),
            usn: -1,
            sortf: 1,
            did: null,
            tmpls: [
                {
                    name: 'Card 1',
                    ord: 0,
                    qfmt: '<div class="direction">{{Direction}}</div><div class="question">{{Front}}</div>',
                    afmt: '<div class="direction">{{Direction}}</div><div class="question">{{Front}}</div><hr id="answer"><div class="answer">{{Back}}</div>',
                    bqfmt: '',
                    bafmt: '',
                    did: null,
                    bfont: '',
                    bsize: 0
                }
            ],
            flds: [
                {
                    name: 'UID',
                    ord: 0,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 20,
                    description: ''
                },
                {
                    name: 'Front',
                    ord: 1,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 20,
                    description: ''
                },
                {
                    name: 'Back',
                    ord: 2,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 20,
                    description: ''
                },
                {
                    name: 'Direction',
                    ord: 3,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 12,
                    description: ''
                }
            ],
            css: `.card {
 font-family: arial;
 font-size: 28px;
 text-align: center;
 color: black;
 background-color: white;
}

.direction {
 font-size: clamp(16px, 3.2vw, 18px);
 font-style: italic;
 color: #666;
 margin-bottom: 10px;
}

@media (max-width: 480px) {
 .direction {
  font-size: 18px;
 }
}

.question {
 font-size: 28px;
 margin-bottom: 10px;
}

.answer {
 font-size: 28px;
}`,
            latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
            latexPost: '\\end{document}',
            latexsvg: false,
            req: [[0, 'any', [0]]]
        };
        return noteType;
    }

    createClozeNoteType() {
        const noteType = {
            id: this.noteTypeId,
            name: this.noteTypeName,
            type: 1,
            mod: Math.floor(Date.now() / 1000),
            usn: -1,
            sortf: 0,
            did: null,
            tmpls: [
                {
                    name: 'Cloze',
                    ord: 0,
                    qfmt: '<div class="hint">{{Hint}}</div>\n{{cloze:Text}}',
                    afmt: '<div class="hint">{{Hint}}</div>\n{{cloze:Text}}',
                    bqfmt: '',
                    bafmt: '',
                    did: null,
                    bfont: '',
                    bsize: 0
                }
            ],
            flds: [
                {
                    name: 'Text',
                    ord: 0,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 20,
                    description: ''
                },
                {
                    name: 'Hint',
                    ord: 1,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 20,
                    description: ''
                },
                {
                    name: 'Back',
                    ord: 2,
                    sticky: false,
                    rtl: false,
                    font: 'Arial',
                    size: 20,
                    description: ''
                }
            ],
            css: `.card {
    font-family: arial;
    font-size: 20px;
    line-height: 1.5;
    text-align: center;
    color: black;
    background-color: white;
}
.cloze {
    font-weight: bold;
    color: blue;
}
.nightMode .cloze {
    color: lightblue;
}
.hint {
  font-size: 0.65em;
  font-style: italic;
  opacity: 0.6;
  margin-bottom: 0.4em;
}
@media (max-width: 480px) {
  .hint {
    font-size: 0.8em;
  }
}`,
            latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
            latexPost: '\\end{document}',
            latexsvg: false,
            req: [[0, 'any', [0]]]
        };

        return noteType;
    }

    createDeckStructure(cards) {
        const decks = {};
        const deckNames = new Set();
        
        // Collect all unique deck names and their parent hierarchies
        cards.forEach(card => {
            const parts = card.deck.split('::');
            for (let i = 1; i <= parts.length; i++) {
                deckNames.add(parts.slice(0, i).join('::'));
            }
        });
        
        // Create deck hierarchy with proper parent-child relationships
        let currentDeckId = this.nextDeckId;
        const now = Math.floor(Date.now() / 1000);
        
        // Sort deck names to ensure parents are created before children
        const sortedNames = Array.from(deckNames).sort((a, b) => {
            const aDepth = a.split('::').length;
            const bDepth = b.split('::').length;
            if (aDepth !== bDepth) return aDepth - bDepth;
            return a.localeCompare(b);
        });
        
        for (const deckName of sortedNames) {
            decks[deckName] = {
                id: currentDeckId++,
                name: deckName,
                mod: now,
                usn: -1,
                collapsed: false,
                browserCollapsed: false,
                desc: '',
                dyn: 0,
                conf: 1,
                extendNew: 0,
                extendRev: 0
            };
        }
        
        this.nextDeckId = currentDeckId;
        return decks;
    }

    createSQLiteDatabase(cards) {
        const initSql = require('sql.js');
        
        return initSql().then(SQL => {
            const db = new SQL.Database();
            
            // Create Anki database schema
            this.createSchema(db);
            
            // Insert collection data
            this.insertCollection(db);
            
            // Create and insert note type
            const noteType = this.createNoteType();
            this.insertNoteType(db, noteType);
            
            // Create deck structure
            const decks = this.createDeckStructure(cards);
            this.insertDecks(db, decks);
            
            // Insert notes and cards
            this.insertNotesAndCards(db, cards, decks);
            
            return db;
        });
    }

    createSchema(db) {
        // Anki database schema - matching DrillMaster exactly
        const schema = `
            CREATE TABLE col (
                id integer primary key,
                crt integer not null,
                mod integer not null,
                scm integer not null,
                ver integer not null,
                dty integer not null,
                usn integer not null,
                ls integer not null,
                conf text not null,
                models text not null,
                decks text not null,
                dconf text not null,
                tags text not null
            );
            
            CREATE TABLE notes (
                id integer primary key,
                guid text not null,
                mid integer not null,
                mod integer not null,
                usn integer not null,
                tags text not null,
                flds text not null,
                sfld text not null,
                csum integer not null,
                flags integer not null,
                data text not null
            );
            
            CREATE TABLE cards (
                id integer primary key,
                nid integer not null,
                did integer not null,
                ord integer not null,
                mod integer not null,
                usn integer not null,
                type integer not null,
                queue integer not null,
                due integer not null,
                ivl integer not null,
                factor integer not null,
                reps integer not null,
                lapses integer not null,
                left integer not null,
                odue integer not null,
                odid integer not null,
                flags integer not null,
                data text not null
            );
            
            CREATE TABLE revlog (
                id integer primary key,
                cid integer not null,
                usn integer not null,
                ease integer not null,
                ivl integer not null,
                lastIvl integer not null,
                factor integer not null,
                time integer not null,
                type integer not null
            );
            
            CREATE TABLE graves (
                usn integer not null,
                oid integer not null,
                type integer not null
            );
            
            CREATE INDEX ix_notes_usn on notes (usn);
            CREATE INDEX ix_cards_usn on cards (usn);
            CREATE INDEX ix_revlog_usn on revlog (usn);
            CREATE INDEX ix_cards_nid on cards (nid);
            CREATE INDEX ix_cards_sched on cards (did, queue, due);
            CREATE INDEX ix_revlog_cid on revlog (cid);
            CREATE INDEX ix_notes_csum on notes (csum);
        `;
        
        db.exec(schema);
    }

    insertCollection(db) {
        const now = Math.floor(Date.now() / 1000);
        
        const conf = {
            nextPos: 1,
            estTimes: true,
            activeDecks: [1],
            sortType: "noteFld",
            timeLim: 0,
            sortBackwards: false,
            addToCur: true,
            curDeck: 1,
            newBury: true,
            newSpread: 0,
            dueCounts: true,
            curModel: this.noteTypeId,
            collapseTime: 1200
        };
        
        const dconf = {
            "1": {
                id: 1,
                mod: 0,
                name: "Default",
                usn: 0,
                maxTaken: 60,
                autoplay: true,
                timer: 0,
                replayq: true,
                "new": {
                    bury: true,
                    delays: [1, 10],
                    initialFactor: 2500,
                    ints: [1, 4, 7],
                    order: 1,
                    perDay: 20,
                    separate: true
                },
                lapse: {
                    delays: [10],
                    leechAction: 0,
                    leechFails: 8,
                    minInt: 1,
                    mult: 0
                },
                rev: {
                    bury: true,
                    ease4: 1.3,
                    fuzz: 0.05,
                    ivlFct: 1,
                    maxIvl: 36500,
                    minSpace: 1,
                    perDay: 100
                }
            }
        };
        
        const stmt = db.prepare(`
            INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
            1, now, now, now, 11, 0, 0, now,
            JSON.stringify(conf),
            JSON.stringify({}), // Will be populated later
            JSON.stringify({}), // Will be populated later  
            JSON.stringify(dconf),
            JSON.stringify({})
        ]);
    }

    insertNoteType(db, noteType) {
        // Update the models in collection using DrillMaster pattern
        const models = {};
        models[noteType.id] = noteType;
        
        const modelsJsonString = JSON.stringify(models).replace(/'/g, "''");
        db.exec(`UPDATE col SET models = '${modelsJsonString}' WHERE id = 1`);
    }

    insertDecks(db, decks) {
        const now = Math.floor(Date.now() / 1000);
        
        // Build decks JSON object matching DrillMaster structure
        const allDecks = {
            1: {
                id: 1,
                name: "Default",
                extendRev: 50,
                usn: 0,
                collapsed: false,
                newToday: [0, 0],
                revToday: [0, 0],
                lrnToday: [0, 0],
                timeToday: [0, 0],
                dyn: 0,
                desc: "",
                conf: 1,
                mod: now
            }
        };
        
        // Add custom decks with complete structure
        Object.values(decks).forEach(deck => {
            allDecks[deck.id] = {
                id: deck.id,
                name: deck.name,
                extendRev: 50,
                usn: 0,
                collapsed: false,
                newToday: [0, 0],
                revToday: [0, 0],
                lrnToday: [0, 0],
                timeToday: [0, 0],
                dyn: 0,
                desc: "",
                conf: 1,
                mod: now
            };
        });
        
        // Use string replacement like DrillMaster to avoid SQL injection issues
        const decksJsonString = JSON.stringify(allDecks).replace(/'/g, "''");
        db.exec(`UPDATE col SET decks = '${decksJsonString}' WHERE id = 1`);
    }

    insertNotesAndCards(db, cards, decks) {
        const noteStmt = db.prepare(`
            INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const cardStmt = db.prepare(`
            INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const now = Math.floor(Date.now() / 1000);

        if (this.mode === 'cloze') {
            const clozeRe = /\{\{c(\d+)::/g;

            cards.forEach(note => {
                const uid = note.uid || `${note.deck}::cloze::${note.text}::${note.hint}`;
                const guid = this.generateGuidFromUid(uid);
                const tags = note.tags ? note.tags.join(' ') : '';
                const text = note.text || '';
                const hint = note.hint || '';
                const back = note.back || '';

                const ords = new Set();
                let m;
                while ((m = clozeRe.exec(text)) !== null) {
                    const n = parseInt(m[1], 10);
                    if (Number.isFinite(n) && n > 0) ords.add(n - 1);
                }

                if (ords.size === 0) {
                    return;
                }

                const noteId = this.nextNoteId++;
                const fields = `${text}\x1f${hint}\x1f${back}`;
                const checksum = this.generateChecksum(text);

                noteStmt.run([
                    noteId, guid, this.noteTypeId, now, -1,
                    tags, fields, text, checksum, 0, ''
                ]);

                const deckId = decks[note.deck]?.id || 1;
                Array.from(ords).sort((a, b) => a - b).forEach(ord => {
                    const cardId = this.nextCardId++;
                    cardStmt.run([
                        cardId, noteId, deckId, ord, now, -1,
                        0, 0, noteId, 0, 2500, 0, 0, 0, 0, 0, 0, ''
                    ]);
                });
            });

            return;
        }

        cards.forEach(card => {
            const noteId = this.nextNoteId++;
            const cardId = this.nextCardId++;
            const uid = card.uid || `${card.deck}::${card.type}::${card.front}::${card.back}`;
            const guid = this.generateGuidFromUid(uid);

            const direction = card.directionLabel !== undefined ? card.directionLabel : (card.type === 'recognition' ? 'Recognition' : 'Production');

            const fields = `${uid}\x1f${card.front}\x1f${card.back}\x1f${direction}`;
            const checksum = this.generateChecksum(uid);
            const tags = card.tags ? card.tags.join(' ') : '';

            noteStmt.run([
                noteId, guid, this.noteTypeId, now, -1,
                tags, fields, card.front, checksum, 0, ''
            ]);

            const deckId = decks[card.deck]?.id || 1;
            cardStmt.run([
                cardId, noteId, deckId, 0, now, -1,
                0, 0, noteId, 0, 2500, 0, 0, 0, 0, 0, 0, ''
            ]);
        });
    }

    async generateApkg(cards, outputPath) {
        console.log('🔧 Creating SQLite database...');
        const db = await this.createSQLiteDatabase(cards);
        
        console.log('📦 Creating .apkg file...');
        const JSZip = require('jszip');
        const zip = new JSZip();
        
        // Add database to zip
        const dbData = db.export();
        zip.file('collection.anki2', Buffer.from(dbData));
        
        // Add media file (empty for now)
        zip.file('media', JSON.stringify({}));
        
        // Generate zip file
        const zipData = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(outputPath, zipData);
        
        console.log(`✅ Anki deck saved to: ${outputPath}`);
        return outputPath;
    }
}

module.exports = AnkiGenerator;
