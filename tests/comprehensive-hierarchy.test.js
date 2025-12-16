const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the functions we want to test
const { findTSVFiles, generateCards, readGlossaryTSV } = require('../generate-decks.js');

describe('Comprehensive Hierarchical Deck Structure', () => {
    let tempDir;
    let testDataDir;

    beforeEach(() => {
        // Create a temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-hierarchy-test-'));
        testDataDir = path.join(tempDir, 'data');
        fs.mkdirSync(testDataDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up temporary directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('Maximum Depth (5 levels)', () => {
        test('should handle exactly 5 levels of nesting', () => {
            // Create 5-level deep structure
            const level1 = path.join(testDataDir, 'Level1');
            const level2 = path.join(level1, 'Level2');
            const level3 = path.join(level2, 'Level3');
            const level4 = path.join(level3, 'Level4');
            const level5 = path.join(level4, 'Level5');
            fs.mkdirSync(level5, { recursive: true });

            const deepFile = path.join(level5, 'deep.tsv');
            fs.writeFileSync(deepFile, 'spanish\tenglish\nprofundo\tdeep\n');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(1);
            expect(files[0]).toMatchObject({
                fileName: 'deep',
                deckPath: 'Level1/Level2/Level3/Level4/Level5',
                filePath: deepFile
            });

            // Test card generation
            const entries = readGlossaryTSV(deepFile);
            const cards = generateCards(entries, files[0].deckPath, 5);

            expect(cards).toHaveLength(2);
            expect(cards[0].deck).toBe('Level1/Level2/Level3/Level4/Level5::Recognition');
            expect(cards[1].deck).toBe('Level1/Level2/Level3/Level4/Level5::Production');
        });

        test('should handle mixed depths in same structure', () => {
            // Create mixed depth structure
            const shallowDir = path.join(testDataDir, 'Shallow');
            const deepDir = path.join(testDataDir, 'Deep', 'Level2', 'Level3', 'Level4', 'Level5');
            fs.mkdirSync(shallowDir, { recursive: true });
            fs.mkdirSync(deepDir, { recursive: true });

            const shallowFile = path.join(shallowDir, 'shallow.tsv');
            const deepFile = path.join(deepDir, 'deep.tsv');
            
            fs.writeFileSync(shallowFile, 'spanish\tenglish\nsomero\tshallow\n');
            fs.writeFileSync(deepFile, 'spanish\tenglish\nprofundo\tdeep\n');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(2);
            
            const shallow = files.find(f => f.fileName === 'shallow');
            const deep = files.find(f => f.fileName === 'deep');

            expect(shallow.deckPath).toBe('Shallow');
            expect(deep.deckPath).toBe('Deep/Level2/Level3/Level4/Level5');
        });
    });

    describe('Deck Naming Conventions', () => {
        test('should create separate subdecks for files in same folder (bug fix test)', () => {
            // Recreate the Short Spanish Stories A1 scenario
            const storiesDir = path.join(testDataDir, 'Short Spanish Stories A1');
            fs.mkdirSync(storiesDir, { recursive: true });

            const glossary1 = path.join(storiesDir, 'glossary1.tsv');
            const glossary2 = path.join(storiesDir, 'glossary2.tsv');
            
            fs.writeFileSync(glossary1, 'spanish\tenglish\nhola\thello\n');
            fs.writeFileSync(glossary2, 'spanish\tenglish\nadiós\tgoodbye\n');

            const files = findTSVFiles(testDataDir);
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath}/${file.fileName}`, 2);
                allCards = allCards.concat(cards);
            });

            // Should create separate subdecks for each glossary
            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            expect(Object.keys(deckCounts)).toContain('Short Spanish Stories A1/glossary1::Recognition');
            expect(Object.keys(deckCounts)).toContain('Short Spanish Stories A1/glossary1::Production');
            expect(Object.keys(deckCounts)).toContain('Short Spanish Stories A1/glossary2::Recognition');
            expect(Object.keys(deckCounts)).toContain('Short Spanish Stories A1/glossary2::Production');

            // Each deck should have 1 card
            expect(deckCounts['Short Spanish Stories A1/glossary1::Recognition']).toBe(1);
            expect(deckCounts['Short Spanish Stories A1/glossary1::Production']).toBe(1);
            expect(deckCounts['Short Spanish Stories A1/glossary2::Recognition']).toBe(1);
            expect(deckCounts['Short Spanish Stories A1/glossary2::Production']).toBe(1);
        });

        test('should handle different top-level folder names correctly', () => {
            const animalsDir = path.join(testDataDir, 'Animals');
            const foodDir = path.join(testDataDir, 'Food');
            const verbsDir = path.join(testDataDir, 'Spanish_Verbs');
            
            fs.mkdirSync(animalsDir, { recursive: true });
            fs.mkdirSync(foodDir, { recursive: true });
            fs.mkdirSync(verbsDir, { recursive: true });

            const petsFile = path.join(animalsDir, 'pets.tsv');
            const fruitsFile = path.join(foodDir, 'fruits.tsv');
            const regularFile = path.join(verbsDir, 'regular.tsv');

            fs.writeFileSync(petsFile, 'spanish\tenglish\nperro\tdog\n');
            fs.writeFileSync(fruitsFile, 'spanish\tenglish\nmanzana\tapple\n');
            fs.writeFileSync(regularFile, 'spanish\tenglish\nhablar\tto speak\n');

            const files = findTSVFiles(testDataDir);
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath}/${file.fileName}`, 2);
                allCards = allCards.concat(cards);
            });

            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            expect(Object.keys(deckCounts)).toContain('Animals/pets::Recognition');
            expect(Object.keys(deckCounts)).toContain('Food/fruits::Recognition');
            expect(Object.keys(deckCounts)).toContain('Spanish_Verbs/regular::Recognition');
        });

        test('should handle special characters in folder names', () => {
            const specialDir = path.join(testDataDir, 'Folder With Spaces-Hyphens_Underscores');
            fs.mkdirSync(specialDir, { recursive: true });

            const specialFile = path.join(specialDir, 'special.tsv');
            fs.writeFileSync(specialFile, 'spanish\tenglish\nespecial\tspecial\n');

            const files = findTSVFiles(testDataDir);
            const entries = readGlossaryTSV(files[0].filePath);
            const cards = generateCards(entries, `${files[0].deckPath}/${files[0].fileName}`, 2);

            expect(cards[0].deck).toBe('Folder With Spaces-Hyphens_Underscores/special::Recognition');
        });
    });

    describe('Leaf vs Non-Leaf Nodes', () => {
        test('should handle decks at leaf nodes (files in deepest folders)', () => {
            const level1 = path.join(testDataDir, 'Level1');
            const level2 = path.join(level1, 'Level2');
            const level3 = path.join(level2, 'Level3');
            fs.mkdirSync(level3, { recursive: true });

            const leafFile = path.join(level3, 'leaf.tsv');
            fs.writeFileSync(leafFile, 'spanish\tenglish\nhoja\tleaf\n');

            const files = findTSVFiles(testDataDir);
            const entries = readGlossaryTSV(files[0].filePath);
            const cards = generateCards(entries, `${files[0].deckPath}/${files[0].fileName}`, 3);

            expect(cards[0].deck).toBe('Level1/Level2/Level3/leaf::Recognition');
        });

        test('should handle decks at non-leaf nodes (files in intermediate folders)', () => {
            const level1 = path.join(testDataDir, 'Level1');
            const level2 = path.join(level1, 'Level2');
            const level3 = path.join(level2, 'Level3');
            fs.mkdirSync(level3, { recursive: true });

            // File at intermediate level
            const intermediateFile = path.join(level2, 'intermediate.tsv');
            fs.writeFileSync(intermediateFile, 'spanish\tenglish\nintermedio\tintermediate\n');

            // File at leaf level
            const leafFile = path.join(level3, 'leaf.tsv');
            fs.writeFileSync(leafFile, 'spanish\tenglish\nhoja\tleaf\n');

            const files = findTSVFiles(testDataDir);
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath}/${file.fileName}`, 2);
                allCards = allCards.concat(cards);
            });

            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            expect(Object.keys(deckCounts)).toContain('Level1/Level2/intermediate::Recognition');
            expect(Object.keys(deckCounts)).toContain('Level1/Level2/Level3/leaf::Recognition');
        });

        test('should handle mixed leaf and non-leaf in same hierarchy', () => {
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            const wildDir = path.join(animalsDir, 'wild');
            fs.mkdirSync(domesticDir, { recursive: true });
            fs.mkdirSync(wildDir, { recursive: true });

            // File at intermediate level (Animals folder)
            const animalFile = path.join(animalsDir, 'general.tsv');
            fs.writeFileSync(animalFile, 'spanish\tenglish\nanimal\tanimal\n');

            // Files at leaf level
            const petsFile = path.join(domesticDir, 'pets.tsv');
            const wildFile = path.join(wildDir, 'wild.tsv');
            
            fs.writeFileSync(petsFile, 'spanish\tenglish\nmascota\tpet\n');
            fs.writeFileSync(wildFile, 'spanish\tenglish\nsalvaje\twild\n');

            const files = findTSVFiles(testDataDir);
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath}/${file.fileName}`, 2);
                allCards = allCards.concat(cards);
            });

            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            expect(Object.keys(deckCounts)).toContain('Animals/general::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals/domestic/pets::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals/wild/wild::Recognition');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle empty directories', () => {
            const emptyDir = path.join(testDataDir, 'Empty');
            fs.mkdirSync(emptyDir, { recursive: true });

            const files = findTSVFiles(testDataDir);
            expect(files).toHaveLength(0);
        });

        test('should handle directories with only non-TSV files', () => {
            const junkDir = path.join(testDataDir, 'Junk');
            fs.mkdirSync(junkDir, { recursive: true });

            const jsonFile = path.join(junkDir, 'data.json');
            const mdFile = path.join(junkDir, 'readme.md');
            const jpgFile = path.join(junkDir, 'image.jpg');

            fs.writeFileSync(jsonFile, '{}');
            fs.writeFileSync(mdFile, '# README');
            fs.writeFileSync(jpgFile, 'fake image data');

            const files = findTSVFiles(testDataDir);
            expect(files).toHaveLength(0);
        });

        test('should handle files with same name in different directories', () => {
            const dir1 = path.join(testDataDir, 'Dir1');
            const dir2 = path.join(testDataDir, 'Dir2');
            fs.mkdirSync(dir1, { recursive: true });
            fs.mkdirSync(dir2, { recursive: true });

            const file1 = path.join(dir1, 'common.tsv');
            const file2 = path.join(dir2, 'common.tsv');

            fs.writeFileSync(file1, 'spanish\tenglish\nuno\tone\n');
            fs.writeFileSync(file2, 'spanish\tenglish\ndos\ttwo\n');

            const files = findTSVFiles(testDataDir);
            expect(files).toHaveLength(2);

            const file1Info = files.find(f => f.filePath === file1);
            const file2Info = files.find(f => f.filePath === file2);

            expect(file1Info.deckPath).toBe('Dir1');
            expect(file2Info.deckPath).toBe('Dir2');
            expect(file1Info.fileName).toBe('common');
            expect(file2Info.fileName).toBe('common');
        });

        test('should handle very long folder names', () => {
            const longName = 'A'.repeat(100);
            const longDir = path.join(testDataDir, longName);
            fs.mkdirSync(longDir, { recursive: true });

            const longFile = path.join(longDir, 'test.tsv');
            fs.writeFileSync(longFile, 'spanish\tenglish\nlargo\tlong\n');

            const files = findTSVFiles(testDataDir);
            expect(files[0].deckPath).toBe(longName);
        });

        test('should handle root-level files correctly', () => {
            const rootFile = path.join(testDataDir, 'root.tsv');
            fs.writeFileSync(rootFile, 'spanish\tenglish\nraíz\troot\n');

            const files = findTSVFiles(testDataDir);
            expect(files[0].deckPath).toBe('.');

            const entries = readGlossaryTSV(rootFile);
            const cards = generateCards(entries, files[0].fileName, 1);

            expect(cards[0].deck).toBe('root::Recognition');
            expect(cards[1].deck).toBe('root::Production');
        });
    });

    describe('Integration Tests - Real World Scenarios', () => {
        test('should handle complete language learning curriculum structure', () => {
            // Create a realistic language learning hierarchy
            const spanishDir = path.join(testDataDir, 'Spanish');
            const beginnerDir = path.join(spanishDir, 'Beginner');
            const intermediateDir = path.join(spanishDir, 'Intermediate');
            const advancedDir = path.join(spanishDir, 'Advanced');
            
            const vocabDir = path.join(beginnerDir, 'Vocabulary');
            const grammarDir = path.join(beginnerDir, 'Grammar');
            const conversationDir = path.join(intermediateDir, 'Conversation');
            const literatureDir = path.join(advancedDir, 'Literature');
            
            fs.mkdirSync(vocabDir, { recursive: true });
            fs.mkdirSync(grammarDir, { recursive: true });
            fs.mkdirSync(conversationDir, { recursive: true });
            fs.mkdirSync(literatureDir, { recursive: true });

            // Create files at various levels
            const basicVocab = path.join(vocabDir, 'basic-words.tsv');
            const basicGrammar = path.join(grammarDir, 'present-tense.tsv');
            const dailyConv = path.join(conversationDir, 'daily-life.tsv');
            const poetry = path.join(literatureDir, 'poetry.tsv');

            fs.writeFileSync(basicVocab, 'spanish\tenglish\ncasa\thouse\n');
            fs.writeFileSync(basicGrammar, 'spanish\tenglish\nsoy\tI am\n');
            fs.writeFileSync(dailyConv, 'spanish\tenglish\n¿Cómo estás?\tHow are you?\n');
            fs.writeFileSync(poetry, 'spanish\tenglish\npoesía\tpoetry\n');

            const files = findTSVFiles(testDataDir);
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath}/${file.fileName}`, 3);
                allCards = allCards.concat(cards);
            });

            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            // Verify all expected decks exist
            expect(Object.keys(deckCounts)).toContain('Spanish/Beginner/Vocabulary/basic-words::Recognition');
            expect(Object.keys(deckCounts)).toContain('Spanish/Beginner/Grammar/present-tense::Recognition');
            expect(Object.keys(deckCounts)).toContain('Spanish/Intermediate/Conversation/daily-life::Recognition');
            expect(Object.keys(deckCounts)).toContain('Spanish/Advanced/Literature/poetry::Recognition');

            // Verify card counts
            expect(Object.keys(deckCounts)).toHaveLength(8); // 4 files × 2 card types
            Object.values(deckCounts).forEach(count => {
                expect(count).toBe(1);
            });
        });

        test('should handle the exact Short Spanish Stories A1 scenario', () => {
            // Recreate the exact scenario from the bug report
            const storiesDir = path.join(testDataDir, 'Short Spanish Stories A1');
            fs.mkdirSync(storiesDir, { recursive: true });

            const glossaries = ['glossary1.tsv', 'glossary2.tsv', 'glossary3.tsv', 'glossary4.tsv', 'glossary5.tsv'];
            const wordCounts = [187, 239, 241, 336, 402];

            glossaries.forEach((filename, index) => {
                const filePath = path.join(storiesDir, filename);
                const content = ['spanish\tenglish'];
                for (let i = 0; i < wordCounts[index]; i++) {
                    content.push(`palabra${i}\tword${i}`);
                }
                fs.writeFileSync(filePath, content.join('\n'));
            });

            const files = findTSVFiles(testDataDir);
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath}/${file.fileName}`, 2);
                allCards = allCards.concat(cards);
            });

            // Verify structure
            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            // Should have 5 glossaries × 2 card types = 10 decks
            expect(Object.keys(deckCounts)).toHaveLength(10);

            // Each glossary should have Recognition and Production decks
            for (let i = 1; i <= 5; i++) {
                expect(Object.keys(deckCounts)).toContain(`Short Spanish Stories A1/glossary${i}::Recognition`);
                expect(Object.keys(deckCounts)).toContain(`Short Spanish Stories A1/glossary${i}::Production`);
                expect(deckCounts[`Short Spanish Stories A1/glossary${i}::Recognition`]).toBe(wordCounts[i-1]);
                expect(deckCounts[`Short Spanish Stories A1/glossary${i}::Production`]).toBe(wordCounts[i-1]);
            }

            // Total cards should be sum of all entries × 2
            const totalEntries = wordCounts.reduce((sum, count) => sum + count, 0);
            expect(allCards).toHaveLength(totalEntries * 2);
        });
    });
});
