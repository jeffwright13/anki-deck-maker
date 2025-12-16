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
        return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
        console.warn(`Warning: ${filePath} is empty`);
        return [];
    }
    
    // Skip header line
    const dataLines = lines.slice(1);
    const entries = [];
    
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const parts = line.split('\t');
        
        if (parts.length !== 2) {
            console.warn(`Warning: Line ${i + 2} in ${filePath} has ${parts.length} columns: ${line}`);
            continue;
        }
        
        const [spanish, english] = parts.map(p => p.trim());
        
        if (!spanish) {
            console.warn(`Warning: Empty Spanish term at line ${i + 2} in ${filePath}`);
            continue;
        }
        
        if (!english) {
            console.warn(`Warning: Empty English translation for "${spanish}" at line ${i + 2} in ${filePath}`);
            continue;
        }
        
        entries.push({ spanish, english });
    }
    
    return entries;
}

function generateCards(entries, deckPath, depth) {
    const cards = [];
    
    entries.forEach(entry => {
        // Handle root-level files vs subdirectory files
        let baseDeck;
        if (deckPath === '.' || deckPath === 'Root') {
            // Files in root data/ directory
            baseDeck = 'Spanish Glossaries';
        } else {
            // Use the full deckPath as hierarchy (includes filename)
            baseDeck = deckPath;
        }
        
        // Recognition card: Spanish -> English
        cards.push({
            type: 'recognition',
            deck: `${baseDeck}::Recognition`,
            front: entry.spanish,
            back: entry.english,
            tags: ['vocabulary', deckPath.replace(/\//g, '-'), 'recognition']
        });
        
        // Production card: English -> Spanish
        cards.push({
            type: 'production',
            deck: `${baseDeck}::Production`,
            front: entry.english,
            back: entry.spanish,
            tags: ['vocabulary', deckPath.replace(/\//g, '-'), 'production']
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

async function main() {
    // Get command line arguments
    const args = process.argv.slice(2);
    const targetFolder = args[0]; // Optional: specific top-level folder to process
    
    if (targetFolder) {
        console.log(`🚀 Generating Anki deck for folder: ${targetFolder}`);
    } else {
        console.log('🚀 Generating Anki deck from all glossary files...');
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
        const entries = readGlossaryTSV(file.filePath);
        
        if (entries.length === 0) {
            console.log(`  ⚠️  No entries found, skipping`);
            continue;
        }
        
        console.log(`  ✅ Found ${entries.length} entries`);
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
        const cards = generateCards(entries, deckName, deckName.split('::').length);
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
        console.log(`\n🎴 Your deck will appear as "Spanish Vocabulary" with subdecks matching your folder hierarchy.`);
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
