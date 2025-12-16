const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the functions we want to test
const { findTSVFiles, generateCards, readGlossaryTSV } = require('../generate-decks.js');

describe('Hierarchical Deck Naming', () => {
    let tempDir;
    let testDataDir;

    beforeEach(() => {
        // Create a temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-test-'));
        testDataDir = path.join(tempDir, 'data');
        fs.mkdirSync(testDataDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up temporary directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('findTSVFiles', () => {
        test('should find TSV files in root directory', () => {
            // Create test files
            const testFile1 = path.join(testDataDir, 'test1.tsv');
            const testFile2 = path.join(testDataDir, 'test2.txt');
            
            fs.writeFileSync(testFile1, 'term1\tterm2\nhola\thello\n');
            fs.writeFileSync(testFile2, 'term1\tterm2\nadiós\tgoodbye\n');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(2);
            expect(files[0]).toMatchObject({
                fileName: 'test1',
                deckPath: '.',
                filePath: testFile1
            });
            expect(files[1]).toMatchObject({
                fileName: 'test2',
                deckPath: '.',
                filePath: testFile2
            });
        });

        test('should find TSV files in nested directories', () => {
            // Create nested directory structure
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            fs.mkdirSync(domesticDir, { recursive: true });

            const petsFile = path.join(domesticDir, 'pets.tsv');
            fs.writeFileSync(petsFile, 'term1\tterm2\nperro\tdog\n');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(1);
            expect(files[0]).toMatchObject({
                fileName: 'pets',
                deckPath: 'Animals/domestic',
                filePath: petsFile
            });
        });

        test('should handle multiple top-level directories', () => {
            // Create Animals directory
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            fs.mkdirSync(domesticDir, { recursive: true });

            const petsFile = path.join(domesticDir, 'pets.tsv');
            fs.writeFileSync(petsFile, 'term1\tterm2\nperro\tdog\n');

            // Create Food directory
            const foodDir = path.join(testDataDir, 'Food');
            const fruitsDir = path.join(foodDir, 'fruits');
            fs.mkdirSync(fruitsDir, { recursive: true });

            const fruitsFile = path.join(fruitsDir, 'citrus.tsv');
            fs.writeFileSync(fruitsFile, 'term1\tterm2\nnaranja\torange\n');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(2);
            
            const animalsFile = files.find(f => f.fileName === 'pets');
            const foodFile = files.find(f => f.fileName === 'citrus');

            expect(animalsFile.deckPath).toBe('Animals/domestic');
            expect(foodFile.deckPath).toBe('Food/fruits');
        });

        test('should handle deep nesting (up to 5 levels)', () => {
            // Create 5-level deep directory structure
            const level1 = path.join(testDataDir, 'Level1');
            const level2 = path.join(level1, 'Level2');
            const level3 = path.join(level2, 'Level3');
            const level4 = path.join(level3, 'Level4');
            const level5 = path.join(level4, 'Level5');
            fs.mkdirSync(level5, { recursive: true });

            const deepFile = path.join(level5, 'deep.tsv');
            fs.writeFileSync(deepFile, 'term1\tterm2\nprofundo\tdeep\n');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(1);
            expect(files[0]).toMatchObject({
                fileName: 'deep',
                deckPath: 'Level1/Level2/Level3/Level4/Level5',
                filePath: deepFile
            });
        });

        test('should ignore non-TSV/TXT files', () => {
            // Create various file types
            const tsvFile = path.join(testDataDir, 'valid.tsv');
            const txtFile = path.join(testDataDir, 'valid.txt');
            const jsonFile = path.join(testDataDir, 'invalid.json');
            const mdFile = path.join(testDataDir, 'invalid.md');

            fs.writeFileSync(tsvFile, 'term1\tterm2\nhola\thello\n');
            fs.writeFileSync(txtFile, 'term1\tterm2\nadiós\tgoodbye\n');
            fs.writeFileSync(jsonFile, '{"test": "data"}');
            fs.writeFileSync(mdFile, '# Markdown file');

            const files = findTSVFiles(testDataDir);

            expect(files).toHaveLength(2);
            expect(files.map(f => f.fileName)).toEqual(expect.arrayContaining(['valid', 'valid']));
        });

        test('should return empty array for non-existent directory', () => {
            const nonExistentDir = path.join(tempDir, 'nonexistent');
            const files = findTSVFiles(nonExistentDir);
            expect(files).toHaveLength(0);
        });
    });

    describe('generateCards', () => {
        test('should generate cards with correct deck names for root-level files', () => {
            const entries = [
                { term1: 'hola', term2: 'hello' },
                { term1: 'adiós', term2: 'goodbye' }
            ];

            const cards = generateCards(entries,  '.', 1, null, false);

            expect(cards).toHaveLength(4); // 2 recognition + 2 production

            // Check recognition cards
            const recognitionCards = cards.filter(c => c.type === 'recognition');
            expect(recognitionCards).toHaveLength(2);
            recognitionCards.forEach(card => {
                expect(card.deck).toBe('Vocabulary::Recognition');
                expect(card.tags).toContain('vocabulary');
                expect(card.tags).toContain('recognition');
            });

            // Check production cards
            const productionCards = cards.filter(c => c.type === 'production');
            expect(productionCards).toHaveLength(2);
            productionCards.forEach(card => {
                expect(card.deck).toBe('Vocabulary::Production');
                expect(card.tags).toContain('vocabulary');
                expect(card.tags).toContain('production');
            });
        });

        test('should generate cards with correct deck names for nested files', () => {
            const entries = [
                { term1: 'perro', term2: 'dog' },
                { term1: 'gato', term2: 'cat' }
            ];

            const cards = generateCards(entries,  'Animals::domestic', 2, null, false);

            expect(cards).toHaveLength(4);

            // Check recognition cards
            const recognitionCards = cards.filter(c => c.type === 'recognition');
            recognitionCards.forEach(card => {
                expect(card.deck).toBe('Animals::domestic::Recognition');
                expect(card.tags).toContain('vocabulary');
                expect(card.tags).toContain('Animals::domestic');
                expect(card.tags).toContain('recognition');
            });

            // Check production cards
            const productionCards = cards.filter(c => c.type === 'production');
            productionCards.forEach(card => {
                expect(card.deck).toBe('Animals::domestic::Production');
                expect(card.tags).toContain('vocabulary');
                expect(card.tags).toContain('Animals::domestic');
                expect(card.tags).toContain('production');
            });
        });

        test('should handle deep nesting deck names correctly', () => {
            const entries = [
                { term1: 'profundo', term2: 'deep' }
            ];

            const cards = generateCards(entries,  'Level1::Level5', 5, null, false);

            expect(cards).toHaveLength(2);

            const recognitionCard = cards.find(c => c.type === 'recognition');
            const productionCard = cards.find(c => c.type === 'production');

            expect(recognitionCard.deck).toBe('Level1::Level5::Recognition');
            expect(productionCard.deck).toBe('Level1::Level5::Production');
        });

        test('should handle different top-level folder names', () => {
            const entries = [{ term1: 'comida', term2: 'food' }];

            const animalsCards = generateCards(entries,  'Animals::wild', 2, null, false);
            const foodCards = generateCards(entries,  'Food::vegetables', 2, null, false);
            const verbsCards = generateCards(entries,  'Spanish_Verbs::regular', 2, null, false);

            expect(animalsCards[0].deck).toBe('Animals::wild::Recognition');
            expect(foodCards[0].deck).toBe('Food::vegetables::Recognition');
            expect(verbsCards[0].deck).toBe('Spanish_Verbs::regular::Recognition');
        });

        test('should generate correct front/back content', () => {
            const entries = [
                { term1: 'hola', term2: 'hello' }
            ];

            const cards = generateCards(entries,  'Test', 1, null, false);

            const recognitionCard = cards.find(c => c.type === 'recognition');
            const productionCard = cards.find(c => c.type === 'production');

            expect(recognitionCard.front).toBe('hola');
            expect(recognitionCard.back).toBe('hello');
            expect(productionCard.front).toBe('hello');
            expect(productionCard.back).toBe('hola');
        });
    });

    describe('Integration Tests', () => {
        test('should process complete hierarchical structure correctly', () => {
            // Create the Animals folder structure as shown in documentation
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            fs.mkdirSync(domesticDir, { recursive: true });

            const petsFile = path.join(domesticDir, 'animals-mammals-domestic-pets.tsv');
            fs.writeFileSync(petsFile, 'term1\tterm2\nperro\tdog\ngato\tcat\n');

            const foodDir = path.join(testDataDir, 'Food');
            const fruitsDir = path.join(foodDir, 'fruits');
            fs.mkdirSync(fruitsDir, { recursive: true });

            const fruitsFile = path.join(fruitsDir, 'food-fruits-citrus.tsv');
            fs.writeFileSync(fruitsFile, 'term1\tterm2\nnaranja\torange\nlimón\tlemon\n');

            const verbsDir = path.join(testDataDir, 'Spanish_Verbs');
            fs.mkdirSync(verbsDir, { recursive: true });

            const regularFile = path.join(verbsDir, 'verbs-regular.tsv');
            fs.writeFileSync(regularFile, 'term1\tterm2\nhablar\tto speak\ncomer\tto eat\n');

            // Process files
            const tsvFiles = findTSVFiles(testDataDir);
            let allCards = [];
            
            tsvFiles.forEach(file => {
                const { entries, header } = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries,  `${file.deckPath.split('/')[0]}::${file.fileName}`, 2, header, false, null, false);
                allCards = allCards.concat(cards);
            });

            // Verify deck structure
            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            // Should have decks for each top-level folder
            expect(Object.keys(deckCounts)).toContain('Animals::animals-mammals-domestic-pets::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals::animals-mammals-domestic-pets::Production');
            expect(Object.keys(deckCounts)).toContain('Food::food-fruits-citrus::Recognition');
            expect(Object.keys(deckCounts)).toContain('Food::food-fruits-citrus::Production');
            expect(Object.keys(deckCounts)).toContain('Spanish_Verbs::verbs-regular::Recognition');
            expect(Object.keys(deckCounts)).toContain('Spanish_Verbs::verbs-regular::Production');

            expect(deckCounts['Animals::animals-mammals-domestic-pets::Recognition']).toBe(2);
            expect(deckCounts['Animals::animals-mammals-domestic-pets::Production']).toBe(2);
            expect(deckCounts['Food::food-fruits-citrus::Recognition']).toBe(2);
            expect(deckCounts['Food::food-fruits-citrus::Production']).toBe(2);
            expect(deckCounts['Spanish_Verbs::verbs-regular::Recognition']).toBe(2);
            expect(deckCounts['Spanish_Verbs::verbs-regular::Production']).toBe(2);

            // Total cards should be 12 (6 entries × 2 card types)
            expect(allCards).toHaveLength(12);
        });
    });
});
