#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AnkiGenerator = require('./lib/anki-generator');

function slugify(text, maxLen = 32) {
    const s = String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function parseArgs(args) {
    const result = {
        help: false,
        mode: 'glossary',
        folder: null,
        directionLabels: false
    };

    const getFlagValue = (name) => {
        const eq = args.find(a => a.startsWith(`${name}=`));
        if (eq) return eq.slice(name.length + 1);
        const idx = args.indexOf(name);
        if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
        return null;
    };

    if (args.includes('--help') || args.includes('-h')) {
        result.help = true;
        return result;
    }

    const mode = getFlagValue('--mode') || getFlagValue('-m');
    if (mode) result.mode = String(mode).trim();

    if (args.includes('--cloze')) {
        result.mode = 'cloze';
    }

    const folder = getFlagValue('--folder') || getFlagValue('-f');
    if (folder) {
        result.folder = String(folder).trim();
    } else {
        const positional = args.find(a => !a.startsWith('-'));
        if (positional) result.folder = positional;
    }

    result.directionLabels = args.includes('--direction-labels') || args.includes('-d');

    if (result.mode === 'cloze') {
        result.directionLabels = false;
    }

    if (result.mode !== 'glossary' && result.mode !== 'cloze') {
        throw new Error(`Unknown mode: ${result.mode}. Expected "glossary" or "cloze".`);
    }

    return result;
}

function readClozeTSV(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: ${filePath} not found, skipping`);
        return { entries: [] };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const entries = [];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = String(raw || '').trim();
        if (!line) continue;

        const parts = raw.split('\t');
        if (parts.length !== 2 && parts.length !== 3) {
            console.warn(`Warning: Line ${i + 1} in ${filePath} has ${parts.length} columns: ${raw}`);
            continue;
        }

        let rowId = null;
        let text, hint;
        if (parts.length === 3) {
            const [idRaw, t, h] = parts;
            rowId = String(idRaw || '').trim() || null;
            text = String(t || '').trim();
            hint = String(h || '').trim();
        } else {
            [text, hint] = parts.map(p => String(p || '').trim());
        }

        if (!text) {
            console.warn(`Warning: Empty text at line ${i + 1} in ${filePath}`);
            continue;
        }

        entries.push({ id: rowId, text, hint });
    }

    return { entries };
}

function shortHashHex(text, length = 8) {
    return crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, length);
}

function makeUid({ deck, type, front, back, rowId }) {
    if (rowId) {
        const canonical = `${deck}||${type}||id=${String(rowId).trim()}`;
        const h = shortHashHex(canonical, 10);
        const deckSlug = slugify(deck, 24);
        const frontSlug = slugify(front, 24);
        return `jw:vocab:${deckSlug}:${type}:${frontSlug}:id=${String(rowId).trim()}::h=${h}`;
    }

    const canonical = `${deck}||${type}||${String(front).trim()}||${String(back).trim()}`;
    const h = shortHashHex(canonical, 10);
    const deckSlug = slugify(deck, 24);
    const frontSlug = slugify(front, 24);
    return `jw:vocab:${deckSlug}:${type}:${frontSlug}::h=${h}`;
}

function makeClozeUid({ deck, text, hint, rowId }) {
    if (rowId) {
        const canonical = `${deck}||cloze||id=${String(rowId).trim()}`;
        const h = shortHashHex(canonical, 10);
        const deckSlug = slugify(deck, 24);
        const hintSlug = slugify(hint, 24);
        return `jw:cloze:${deckSlug}:${hintSlug}:id=${String(rowId).trim()}::h=${h}`;
    }

    const canonical = `${deck}||cloze||${String(text).trim()}||${String(hint).trim()}`;
    const h = shortHashHex(canonical, 10);
    const deckSlug = slugify(deck, 24);
    const hintSlug = slugify(hint, 24);
    return `jw:cloze:${deckSlug}:${hintSlug}::h=${h}`;
}

function generateClozeNotes(entries, deckName) {
    const notes = [];

    entries.forEach((entry, idx) => {
        const uid = makeClozeUid({
            deck: deckName,
            text: entry.text,
            hint: entry.hint,
            rowId: entry.id || String(idx + 1)
        });

        notes.push({
            type: 'cloze',
            deck: deckName,
            text: entry.text,
            hint: entry.hint,
            back: '',
            uid,
            tags: ['cloze', deckName.replace(/::/g, '-').replace(/\//g, '-')]
        });
    });

    return notes;
}

/**
 * Generate Anki deck from glossary TSV files
 * Creates Recognition (ES->EN) and Production (EN->ES) cards
 * Organized in subdecks based on folder hierarchy in data/ directory
 * Supports up to 5 levels of nesting
 */

function readGlossaryTSV(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: ${filePath} not found, skipping`);
        return { entries: [], header: null };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        console.warn(`Warning: ${filePath} is empty`);
        return { entries: [], header: null };
    }

    // Parse header line
    const headerParts = lines[0].split('\t').map(p => p.trim());
    let header = null;

    if (headerParts.length === 2) {
        header = {
            term1Label: headerParts[0],
            term2Label: headerParts[1]
        };
    } else if (headerParts.length === 3) {
        header = {
            term1Label: headerParts[1],
            term2Label: headerParts[2],
            hasId: true
        };
    } else {
        console.warn(`Warning: Invalid header format in ${filePath}: "${lines[0]}". Expected 2 or 3 columns.`);
    }

    // Process data lines (skip header)
    const dataLines = lines.slice(1);
    const entries = [];

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const parts = line.split('\t');

        if (parts.length !== 2 && parts.length !== 3) {
            console.warn(`Warning: Line ${i + 2} in ${filePath} has ${parts.length} columns: ${line}`);
            continue;
        }

        let rowId = null;
        let term1, term2;
        if (parts.length === 3) {
            const [idRaw, t1, t2] = parts;
            rowId = String(idRaw || '').trim() || null;
            term1 = String(t1 || '').trim();
            term2 = String(t2 || '').trim();
        } else {
            [term1, term2] = parts.map(p => p.trim());
        }

        if (!term1) {
            console.warn(`Warning: Empty term1 at line ${i + 2} in ${filePath}`);
            continue;
        }

        if (!term2) {
            console.warn(`Warning: Empty term2 for "${term1}" at line ${i + 2} in ${filePath}`);
            continue;
        }

        entries.push({ id: rowId, term1, term2 });
    }

    return { entries, header };
}

function generateCards(entries, deckPath, depth, header, includeDirectionLabels = true) {
    const cards = [];

    // Generate direction labels based on header and option
    let recognitionLabel, productionLabel;
    if (includeDirectionLabels && header) {
        recognitionLabel = `${header.term1Label} → ${header.term2Label}`;
        productionLabel = `${header.term2Label} → ${header.term1Label}`;
    } else {
        recognitionLabel = '';
        productionLabel = '';
    }

    entries.forEach(entry => {
        // Handle root-level files vs subdirectory files
        let baseDeck;
        if (deckPath === '.' || deckPath === 'Root') {
            // Files in root data/ directory
            baseDeck = 'Vocabulary';
        } else {
            // Use the full deckPath as hierarchy (includes filename)
            baseDeck = deckPath;
        }

        // Recognition card: term1 -> term2
        const recognitionUid = makeUid({
            deck: `${baseDeck}::Recognition`,
            type: 'recognition',
            front: entry.term1,
            back: entry.term2,
            rowId: entry.id
        });
        cards.push({
            type: 'recognition',
            deck: `${baseDeck}::Recognition`,
            front: entry.term1,
            back: entry.term2,
            uid: recognitionUid,
            tags: ['vocabulary', deckPath.replace(/\//g, '-'), 'recognition'],
            directionLabel: recognitionLabel
        });

        // Production card: term2 -> term1
        const productionUid = makeUid({
            deck: `${baseDeck}::Production`,
            type: 'production',
            front: entry.term2,
            back: entry.term1,
            rowId: entry.id
        });
        cards.push({
            type: 'production',
            deck: `${baseDeck}::Production`,
            front: entry.term2,
            back: entry.term1,
            uid: productionUid,
            tags: ['vocabulary', deckPath.replace(/\//g, '-'), 'production'],
            directionLabel: productionLabel
        });
    });
    
    return cards;
}

/**
 * Recursively find all .tsv files in directory and build deck hierarchy
 */
function findTSVFiles(dir, basePath = '', targetFolder = null) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
        return files;
    }
    
    const items = fs.readdirSync(dir);
    
    // If we have a target folder filter, only process that folder at the root level
    if (targetFolder && basePath === '') {
        const targetItem = items.find(item => item === targetFolder);
        if (!targetItem) {
            console.log(`❌ Folder "${targetFolder}" not found in data/ directory`);
            return files;
        }
        // Only process the target folder
        const targetPath = path.join(dir, targetFolder);
        if (fs.statSync(targetPath).isDirectory()) {
            const subFiles = findTSVFiles(targetPath, targetFolder, targetFolder);
            files.push(...subFiles);
        }
        return files;
    }
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Recursively scan subdirectories
            const subFiles = findTSVFiles(fullPath, path.join(basePath, item), targetFolder);
            files.push(...subFiles);
        } else if (item.endsWith('.tsv') || item.endsWith('.txt')) {
            // Add TSV/TXT files with their relative path as deck hierarchy
            const relativePath = path.join(basePath, item);
            files.push({
                filePath: fullPath,
                deckPath: path.dirname(relativePath).replace(/\\/g, '/'), // Normalize path separators
                fileName: path.basename(item, path.extname(item))
            });
        }
    }
    
    return files;
}

function showHelp() {
    console.log(`
Anki Deck Maker - Universal Flashcard Generator

USAGE:
  node generate-decks.js [--mode glossary|cloze] [--folder <TopLevelFolder>] [options]
  node generate-decks.js --folder <TopLevelFolder> [options]
  node generate-decks.js [folder-name] [options]

ARGUMENTS:
  folder-name    Optional: Generate cards only for specific top-level folder
                 If omitted, processes all folders in data/ directory
                 NOTE: For folder names with spaces, use: --folder "Folder Name"

OPTIONS:
  --help, -h              Show this help message
  --mode, -m              Select generation mode: glossary (default) or cloze
  --folder, -f            Restrict generation to a specific top-level folder under data/
  --cloze                 Legacy alias for: --mode cloze
  --direction-labels, -d  (glossary mode only) Enable direction labels (requires TSV header row)

OUTPUT:
  Generated .apkg files are saved to the output/ directory
  Debug information is saved to debug/generated-cards.json

FOR MORE INFORMATION:
  See README.md for detailed usage instructions and TSV file format
`);
}

async function main() {
    const args = process.argv.slice(2);

    let parsed;
    try {
        parsed = parseArgs(args);
    } catch (e) {
        console.error(String(e && e.message ? e.message : e));
        showHelp();
        process.exitCode = 2;
        return;
    }

    if (parsed.help) {
        showHelp();
        return;
    }

    const includeCloze = parsed.mode === 'cloze';
    const includeDirectionLabels = parsed.directionLabels;
    const targetFolder = parsed.folder;
    
    if (targetFolder) {
        console.log(`🚀 Generating Anki deck for folder: ${targetFolder}`);
    } else {
        console.log('🚀 Generating Anki deck from all files...');
    }

    if (includeCloze) {
        console.log('🧩 Mode: CLOZE');
    } else {
        console.log('🧾 Mode: GLOSSARY');
        if (includeDirectionLabels) {
            console.log('📝 Direction labels: ENABLED');
        } else {
            console.log('📝 Direction labels: DISABLED');
        }
    }
    
    const dataDir = path.join(__dirname, 'data');
    const outputDir = path.join(__dirname, 'output'); // Declared here
    
    // Find all TSV/TXT files recursively (with optional folder filter)
    const tsvFiles = findTSVFiles(dataDir, '', targetFolder);
    
    if (tsvFiles.length === 0) {
        console.log('❌ No TSV/TXT files found in data/ directory');
        return;
    }
    
    console.log(`📁 Found ${tsvFiles.length} glossary files in hierarchy:`);
    tsvFiles.forEach(file => {
        const deckPath = file.deckPath === '.' ? 'root' : file.deckPath;
        console.log(`  📄 ${file.fileName} → ${deckPath}`);
    });
    
    let allCards = [];
    let totalEntries = 0;
    
    for (const file of tsvFiles) {
        console.log(`\n📖 Reading ${file.fileName}...`);
        const { entries, header } = includeCloze ? { ...readClozeTSV(file.filePath), header: null } : readGlossaryTSV(file.filePath);
        
        if (entries.length === 0) {
            console.log(`  ⚠️  No entries found, skipping`);
            continue;
        }
        
        console.log(`  ✅ Found ${entries.length} entries`);
        if (header) {
            console.log(`  📝 Header: ${header.term1Label} → ${header.term2Label}`);
        }
        totalEntries += entries.length;
        
        // Generate cards for this file using uber-deck structure
        let deckName;
        if (file.deckPath === '.' || file.deckPath === 'Root') {
            // Files in root data/ directory - use filename as subdeck under uber-deck
            deckName = file.fileName;
        } else {
            if (includeCloze) {
                deckName = `${file.deckPath.replace(/\//g, '::')}::${file.fileName}`;
            } else {
                const topLevelFolder = file.deckPath.split('/')[0];
                deckName = `${topLevelFolder}::${file.fileName}`;
            }
        }
        if (includeCloze) {
            const notes = generateClozeNotes(entries, deckName);
            allCards = allCards.concat(notes);
            console.log(`  🎴 Generated ${notes.length} cloze notes`);
        } else {
            const cards = generateCards(entries, deckName, deckName.split('::').length, header, includeDirectionLabels);
            allCards = allCards.concat(cards);
            console.log(`  🎴 Generated ${cards.length} cards (${entries.length} recognition + ${entries.length} production)`);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total entries: ${totalEntries}`);
    console.log(`  Total cards generated: ${allCards.length}`);
    console.log(`  Recognition cards: ${allCards.filter(c => c.type === 'recognition').length}`);
    console.log(`  Production cards: ${allCards.filter(c => c.type === 'production').length}`);
    console.log(`  Cloze notes: ${allCards.filter(c => c.type === 'cloze').length}`);
    
    // Group by deck for summary
    const deckCounts = {};
    allCards.forEach(card => {
        deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
    });
    
    console.log(`\n🗂️  Deck structure:`);
    Object.keys(deckCounts).sort().forEach(deck => {
        console.log(`  ${deck}: ${deckCounts[deck]} cards`);
    });
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save cards to JSON for debugging (in separate debug directory to prevent accidental deletion)
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    const jsonPath = path.join(debugDir, 'generated-cards.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allCards, null, 2));
    console.log(`\n💾 Cards saved to: ${jsonPath}`);
    
    // Generate .apkg file
    const generator = new AnkiGenerator({
        mode: includeCloze ? 'cloze' : 'glossary',
        noteTypeName: includeCloze ? 'JW::Spanish Cloze v1' : undefined
    });
    
    // Determine output filename based on processed folders
    let outputFilename;
    if (targetFolder) {
        // Use specified folder name
        outputFilename = includeCloze ? `${targetFolder}-cloze.apkg` : `${targetFolder}.apkg`;
    } else if (tsvFiles.length > 0) {
        // Auto-detect top-level folder from first file's path
        const firstFile = tsvFiles[0];
        const topLevelFolder = firstFile.deckPath.split('/')[0];
        outputFilename = includeCloze ? `${topLevelFolder}-cloze.apkg` : `${topLevelFolder}.apkg`;
    } else {
        // Fallback for empty case
        outputFilename = includeCloze ? 'Cloze.apkg' : 'Spanish-Vocabulary-Hierarchical.apkg';
    }
    
    const apkgPath = path.join(outputDir, outputFilename);
    
    try {
        await generator.generateApkg(allCards, apkgPath);
        console.log(`\n🎉 SUCCESS! Anki deck created: ${apkgPath}`);
        console.log(`\n📝 Import instructions:`);
        console.log(`  1. Open Anki`);
        console.log(`  2. File → Import`);
        console.log(`  3. Select: ${apkgPath}`);
        console.log(`  4. Click Import`);
        console.log(`\n🎴 Your deck will appear with your custom naming based on folder structure.`);
    } catch (error) {
        console.error(`\n❌ Error generating .apkg file:`, error);
        console.log(`\n🔧 Debug info saved to: ${jsonPath}`);
        throw error;
    }
        
    return allCards;
}

if (require.main === module) {
    main().catch(console.error);
} else {
    // Export for testing
    module.exports = {
        readClozeTSV,
        readGlossaryTSV,
        generateCards,
        findTSVFiles,
        main
    };
}
