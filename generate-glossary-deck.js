#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AnkiGenerator = require('./lib/anki-generator');

/**
 * Generate Anki deck from glossary TSV files
 * Creates Recognition (ES->EN) and Production (EN->ES) cards
 * Organized in subdecks under "Short Spanish Stories A1::Glossaries"
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

function generateCards(glossaryEntries, glossaryName) {
    const cards = [];
    
    for (const entry of glossaryEntries) {
        // Recognition card: Spanish -> English
        cards.push({
            type: 'recognition',
            deck: `Short Spanish Stories A1::Glossaries::${glossaryName}::Recognition`,
            front: entry.spanish,
            back: entry.english,
            tags: ['glossary', glossaryName.toLowerCase(), 'recognition']
        });
        
        // Production card: English -> Spanish
        cards.push({
            type: 'production',
            deck: `Short Spanish Stories A1::Glossaries::${glossaryName}::Production`,
            front: entry.english,
            back: entry.spanish,
            tags: ['glossary', glossaryName.toLowerCase(), 'production']
        });
    }
    
    return cards;
}

async function main() {
    console.log('🚀 Generating Anki deck from glossary files...');
    
    const dataDir = path.join(__dirname, 'data');
    const glossaryFiles = [
        { file: 'glossary1.txt', name: 'Glossary 1' },
        { file: 'glossary2.txt', name: 'Glossary 2' },
        { file: 'glossary3.txt', name: 'Glossary 3' },
        { file: 'glossary4.txt', name: 'Glossary 4' },
        { file: 'glossary5.txt', name: 'Glossary 5' }
    ];
    
    let allCards = [];
    let totalEntries = 0;
    
    for (const { file, name } of glossaryFiles) {
        const filePath = path.join(dataDir, file);
        console.log(`📖 Reading ${file}...`);
        
        const entries = readGlossaryTSV(filePath);
        if (entries.length === 0) {
            console.log(`  ⚠️  No valid entries found in ${file}`);
            continue;
        }
        
        console.log(`  ✅ Found ${entries.length} entries`);
        totalEntries += entries.length;
        
        const cards = generateCards(entries, name);
        allCards = allCards.concat(cards);
        
        console.log(`  🎴 Generated ${cards.length} cards (${cards.length/2} recognition + ${cards.length/2} production)`);
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
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save cards to JSON for debugging
    const jsonPath = path.join(outputDir, 'generated-cards.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allCards, null, 2));
    console.log(`\n💾 Cards saved to: ${jsonPath}`);
    
    // Generate .apkg file
    const generator = new AnkiGenerator();
    const apkgPath = path.join(outputDir, 'Short-Spanish-Stories-A1-Glossaries.apkg');
    
    try {
        await generator.generateApkg(allCards, apkgPath);
        console.log(`\n🎉 SUCCESS! Anki deck created: ${apkgPath}`);
        console.log(`\n📝 Import instructions:`);
        console.log(`  1. Open Anki`);
        console.log(`  2. File → Import`);
        console.log(`  3. Select: ${apkgPath}`);
        console.log(`  4. Click Import`);
        console.log(`\n🎴 Your deck will appear as "Short Spanish Stories A1::Glossaries" with subdecks for each glossary and card type.`);
    } catch (error) {
        console.error(`\n❌ Error generating .apkg file:`, error);
        console.log(`\n🔧 Debug info saved to: ${jsonPath}`);
        throw error;
    }
    
    return allCards;
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { readGlossaryTSV, generateCards, main };
