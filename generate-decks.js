#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AnkiGenerator = require('./lib/anki-generator');

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
    } else {
        console.warn(`Warning: Invalid header format in ${filePath}: "${lines[0]}". Expected 2 columns.`);
    }
    
    // Process data lines (skip header)
    const dataLines = lines.slice(1);
    const entries = [];
    
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const parts = line.split('\t');
        
        if (parts.length !== 2) {
            console.warn(`Warning: Line ${i + 2} in ${filePath} has ${parts.length} columns: ${line}`);
            continue;
        }
        
        const [term1, term2] = parts.map(p => p.trim());
        
        if (!term1) {
            console.warn(`Warning: Empty term1 at line ${i + 2} in ${filePath}`);
            continue;
        }
        
        if (!term2) {
            console.warn(`Warning: Empty term2 for "${term1}" at line ${i + 2} in ${filePath}`);
            continue;
        }
        
        entries.push({ term1, term2 });
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
        cards.push({
            type: 'recognition',
            deck: `${baseDeck}::Recognition`,
            front: entry.term1,
            back: entry.term2,
            tags: ['vocabulary', deckPath.replace(/\//g, '-'), 'recognition'],
            directionLabel: recognitionLabel
        });
        
        // Production card: term2 -> term1
        cards.push({
            type: 'production',
            deck: `${baseDeck}::Production`,
            front: entry.term2,
            back: entry.term1,
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
        if (!items.includes(targetFolder)) {
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
  node generate-decks.js [folder-name] [options]

ARGUMENTS:
  folder-name    Optional: Generate cards only for specific top-level folder
                 If omitted, processes all folders in data/ directory

OPTIONS:
  --help, -h              Show this help message
  --direction-labels, -d  Enable direction labels on cards (e.g., "ES → EN")
                          REQUIRES: First row in TSV must contain labels
                          Default: DISABLED (no text at top of cards)

OUTPUT:
  Generated .apkg files are saved to the output/ directory
  Debug information is saved to debug/generated-cards.json

FOR MORE INFORMATION:
  See README.md for detailed usage instructions and TSV file format
`);
}

async function main() {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    // Handle help flags
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }
    
    // Parse options
    const includeDirectionLabels = args.includes('--direction-labels') || args.includes('-d');
    const targetFolder = args.find(arg => !arg.startsWith('--') && arg !== '-d'); // First non-option argument
    
    if (targetFolder) {
        console.log(`🚀 Generating Anki deck for folder: ${targetFolder}`);
    } else {
        console.log('🚀 Generating Anki deck from all glossary files...');
    }
    
    if (includeDirectionLabels) {
        console.log('📝 Direction labels: ENABLED');
    } else {
        console.log('📝 Direction labels: DISABLED');
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
        const { entries, header } = readGlossaryTSV(file.filePath);
        
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
            // Files in subdirectories - create uber-deck::folder::filename structure
            // This creates: "TopLevelFolder::glossary1::Recognition" etc.
            const topLevelFolder = file.deckPath.split('/')[0];
            deckName = `${topLevelFolder}::${file.fileName}`;
        }
        const cards = generateCards(entries, deckName, deckName.split('::').length, header, includeDirectionLabels);
        allCards = allCards.concat(cards);
        
        console.log(`  🎴 Generated ${cards.length} cards (${entries.length} recognition + ${entries.length} production)`);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total glossary entries: ${totalEntries}`);
    console.log(`  Total cards generated: ${allCards.length}`);
    console.log(`  Recognition cards: ${allCards.filter(c => c.type === 'recognition').length}`);
    console.log(`  Production cards: ${allCards.filter(c => c.type === 'production').length}`);
    
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
    const generator = new AnkiGenerator();
    
    // Determine output filename based on processed folders
    let outputFilename;
    if (targetFolder) {
        // Use specified folder name
        outputFilename = `${targetFolder}.apkg`;
    } else if (tsvFiles.length > 0) {
        // Auto-detect top-level folder from first file's path
        const firstFile = tsvFiles[0];
        const topLevelFolder = firstFile.deckPath.split('/')[0];
        outputFilename = `${topLevelFolder}.apkg`;
    } else {
        // Fallback for empty case
        outputFilename = 'Spanish-Vocabulary-Hierarchical.apkg';
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
        readGlossaryTSV,
        generateCards,
        findTSVFiles,
        main
    };
}
