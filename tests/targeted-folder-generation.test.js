const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the functions we want to test
const { findTSVFiles, generateCards, readGlossaryTSV } = require('../generate-decks.js');

describe('Targeted Folder Generation', () => {
    let tempDir;
    let testDataDir;

    beforeEach(() => {
        // Create a temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-targeted-test-'));
        testDataDir = path.join(tempDir, 'data');
        fs.mkdirSync(testDataDir, { recursive: true });
    });

    afterEach(() => {
        // Clean up temporary directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('findTSVFiles with targetFolder filter', () => {
        test('should only process specified target folder', () => {
            // Create multiple top-level folders
            const animalsDir = path.join(testDataDir, 'Animals');
            const foodDir = path.join(testDataDir, 'Food');
            const verbsDir = path.join(testDataDir, 'Spanish_Verbs');
            
            fs.mkdirSync(animalsDir, { recursive: true });
            fs.mkdirSync(foodDir, { recursive: true });
            fs.mkdirSync(verbsDir, { recursive: true });

            // Add files to each folder
            const petsFile = path.join(animalsDir, 'pets.tsv');
            const fruitsFile = path.join(foodDir, 'fruits.tsv');
            const regularFile = path.join(verbsDir, 'regular.tsv');

            fs.writeFileSync(petsFile, 'spanish\tenglish\nperro\tdog\n');
            fs.writeFileSync(fruitsFile, 'spanish\tenglish\nmanzana\tapple\n');
            fs.writeFileSync(regularFile, 'spanish\tenglish\nhablar\tto speak\n');

            // Test filtering to Animals folder only
            const files = findTSVFiles(testDataDir, '', 'Animals');

            expect(files).toHaveLength(1);
            expect(files[0]).toMatchObject({
                fileName: 'pets',
                deckPath: 'Animals',
                filePath: petsFile
            });
        });

        test('should handle nested structures within target folder', () => {
            // Create nested structure in Animals folder
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            const wildDir = path.join(animalsDir, 'wild');
            
            fs.mkdirSync(domesticDir, { recursive: true });
            fs.mkdirSync(wildDir, { recursive: true });

            const petsFile = path.join(domesticDir, 'pets.tsv');
            const forestFile = path.join(wildDir, 'forest.tsv');

            fs.writeFileSync(petsFile, 'spanish\tenglish\nperro\tdog\n');
            fs.writeFileSync(forestFile, 'spanish\tenglish\nlobo\twolf\n');

            const files = findTSVFiles(testDataDir, '', 'Animals');

            expect(files).toHaveLength(2);
            
            const pets = files.find(f => f.fileName === 'pets');
            const forest = files.find(f => f.fileName === 'forest');

            expect(pets.deckPath).toBe('Animals/domestic');
            expect(forest.deckPath).toBe('Animals/wild');
        });

        test('should return empty array for non-existent target folder', () => {
            const files = findTSVFiles(testDataDir, '', 'NonExistent');
            expect(files).toHaveLength(0);
        });

        test('should handle target folder with no TSV files', () => {
            const emptyDir = path.join(testDataDir, 'EmptyFolder');
            fs.mkdirSync(emptyDir, { recursive: true });

            const files = findTSVFiles(testDataDir, '', 'EmptyFolder');
            expect(files).toHaveLength(0);
        });

        test('should handle target folder with only non-TSV files', () => {
            const junkDir = path.join(testDataDir, 'JunkFolder');
            fs.mkdirSync(junkDir, { recursive: true });

            const jsonFile = path.join(junkDir, 'data.json');
            const mdFile = path.join(junkDir, 'readme.md');

            fs.writeFileSync(jsonFile, '{}');
            fs.writeFileSync(mdFile, '# README');

            const files = findTSVFiles(testDataDir, '', 'JunkFolder');
            expect(files).toHaveLength(0);
        });
    });

    describe('Deck Generation with Targeted Folders', () => {
        test('should generate correct deck structure for Animals folder', () => {
            // Recreate the Animals hierarchy from the example
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            const wildDir = path.join(animalsDir, 'wild');
            const marineDir = path.join(animalsDir, 'marine');
            
            fs.mkdirSync(domesticDir, { recursive: true });
            fs.mkdirSync(wildDir, { recursive: true });
            fs.mkdirSync(marineDir, { recursive: true });

            // Create test files
            const petsFile = path.join(domesticDir, 'pets.tsv');
            const farmFile = path.join(domesticDir, 'farm.tsv');
            const forestFile = path.join(wildDir, 'forest.tsv');
            const whalesFile = path.join(marineDir, 'whales.tsv');

            fs.writeFileSync(petsFile, 'spanish\tenglish\nperro\tdog\ngato\tcat\n');
            fs.writeFileSync(farmFile, 'spanish\tenglish\nvaca\tcow\n');
            fs.writeFileSync(forestFile, 'spanish\tenglish\nlobo\twolf\n');
            fs.writeFileSync(whalesFile, 'spanish\tenglish\nballena\twhale\n');

            const files = findTSVFiles(testDataDir, '', 'Animals');
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath.split('/')[0]}::${file.fileName}`, 3);
                allCards = allCards.concat(cards);
            });

            // Verify deck structure
            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            // Should have decks for each file, under Animals hierarchy
            expect(Object.keys(deckCounts)).toContain('Animals::pets::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals::pets::Production');
            expect(Object.keys(deckCounts)).toContain('Animals::farm::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals::farm::Production');
            expect(Object.keys(deckCounts)).toContain('Animals::forest::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals::forest::Production');
            expect(Object.keys(deckCounts)).toContain('Animals::whales::Recognition');
            expect(Object.keys(deckCounts)).toContain('Animals::whales::Production');

            // Verify card counts
            expect(deckCounts['Animals::pets::Recognition']).toBe(2);
            expect(deckCounts['Animals::pets::Production']).toBe(2);
            expect(deckCounts['Animals::farm::Recognition']).toBe(1);
            expect(deckCounts['Animals::farm::Production']).toBe(1);
            expect(deckCounts['Animals::forest::Recognition']).toBe(1);
            expect(deckCounts['Animals::forest::Production']).toBe(1);
            expect(deckCounts['Animals::whales::Recognition']).toBe(1);
            expect(deckCounts['Animals::whales::Production']).toBe(1);

            // Total cards should be 10 (5 entries × 2 card types)
            expect(allCards).toHaveLength(10);
        });

        test('should handle single-level target folder', () => {
            const foodDir = path.join(testDataDir, 'Food');
            fs.mkdirSync(foodDir, { recursive: true });

            const fruitsFile = path.join(foodDir, 'fruits.tsv');
            const vegetablesFile = path.join(foodDir, 'vegetables.tsv');

            fs.writeFileSync(fruitsFile, 'spanish\tenglish\nmanzana\tapple\n');
            fs.writeFileSync(vegetablesFile, 'spanish\tenglish\nzanahoria\tcarrot\n');

            const files = findTSVFiles(testDataDir, '', 'Food');
            let allCards = [];

            files.forEach(file => {
                const entries = readGlossaryTSV(file.filePath);
                const cards = generateCards(entries, `${file.deckPath.split('/')[0]}::${file.fileName}`, 2);
                allCards = allCards.concat(cards);
            });

            const deckCounts = {};
            allCards.forEach(card => {
                deckCounts[card.deck] = (deckCounts[card.deck] || 0) + 1;
            });

            expect(Object.keys(deckCounts)).toContain('Food::fruits::Recognition');
            expect(Object.keys(deckCounts)).toContain('Food::fruits::Production');
            expect(Object.keys(deckCounts)).toContain('Food::vegetables::Recognition');
            expect(Object.keys(deckCounts)).toContain('Food::vegetables::Production');
        });

        test('should handle deep nesting in target folder', () => {
            // Create 5-level deep structure
            const level1 = path.join(testDataDir, 'DeepFolder');
            const level2 = path.join(level1, 'Level2');
            const level3 = path.join(level2, 'Level3');
            const level4 = path.join(level3, 'Level4');
            const level5 = path.join(level4, 'Level5');
            fs.mkdirSync(level5, { recursive: true });

            const deepFile = path.join(level5, 'deep.tsv');
            fs.writeFileSync(deepFile, 'spanish\tenglish\nprofundo\tdeep\n');

            const files = findTSVFiles(testDataDir, '', 'DeepFolder');
            const entries = readGlossaryTSV(files[0].filePath);
            const cards = generateCards(entries, `${files[0].deckPath.split('/')[0]}::${files[0].fileName}`, 5);

            expect(cards[0].deck).toBe('DeepFolder::deep::Recognition');
            expect(cards[1].deck).toBe('DeepFolder::deep::Production');
        });
    });

    describe('Integration Tests - Real World Scenarios', () => {
        test('should handle Animals folder example from documentation', () => {
            // Create the Animals folder structure as shown in documentation
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            const wildDir = path.join(animalsDir, 'wild');
            const marineDir = path.join(animalsDir, 'marine');
            
            fs.mkdirSync(domesticDir, { recursive: true });
            fs.mkdirSync(wildDir, { recursive: true });
            fs.mkdirSync(marineDir, { recursive: true });

            // Create representative files
            const petsFile = path.join(domesticDir, 'animals-mammals-domestic-pets.tsv');
            const farmFile = path.join(domesticDir, 'animals-mammals-domestic-farm.tsv');
            const workingFile = path.join(domesticDir, 'animals-mammals-domestic-working.tsv');
            const forestFile = path.join(wildDir, 'animals-mammals-wild-forest.tsv');
            const savannaFile = path.join(wildDir, 'animals-mammals-wild-savanna.tsv');
            const arcticFile = path.join(wildDir, 'animals-mammals-wild-arctic.tsv');
            const whalesFile = path.join(marineDir, 'animals-mammals-marine-whales.tsv');
            const dolphinsFile = path.join(marineDir, 'animals-mammals-marine-dolphins.tsv');

            // Add content to each file
            const testFiles = [
                petsFile, farmFile, workingFile, forestFile, 
                savannaFile, arcticFile, whalesFile, dolphinsFile
            ];

            testFiles.forEach((file, index) => {
                fs.writeFileSync(file, `spanish\tenglish\nanimal${index}\tanimal${index}\n`);
            });

            const files = findTSVFiles(testDataDir, '', 'Animals');
            
            expect(files).toHaveLength(8);
            
            // Verify all files are found with correct paths (order not guaranteed)
            const deckPaths = files.map(f => f.deckPath);
            expect(deckPaths).toContain('Animals/domestic');
            expect(deckPaths).toContain('Animals/domestic');
            expect(deckPaths).toContain('Animals/domestic');
            expect(deckPaths).toContain('Animals/wild');
            expect(deckPaths).toContain('Animals/wild');
            expect(deckPaths).toContain('Animals/wild');
            expect(deckPaths).toContain('Animals/marine');
            expect(deckPaths).toContain('Animals/marine');
            
            // Count occurrences of each path
            const pathCounts = {};
            deckPaths.forEach(path => {
                pathCounts[path] = (pathCounts[path] || 0) + 1;
            });
            
            expect(pathCounts['Animals/domestic']).toBe(3);
            expect(pathCounts['Animals/wild']).toBe(3);
            expect(pathCounts['Animals/marine']).toBe(2);
        });

        test('should exclude other folders when targeting specific folder', () => {
            // Create Animals folder (target)
            const animalsDir = path.join(testDataDir, 'Animals');
            const domesticDir = path.join(animalsDir, 'domestic');
            fs.mkdirSync(domesticDir, { recursive: true });

            const petsFile = path.join(domesticDir, 'pets.tsv');
            fs.writeFileSync(petsFile, 'spanish\tenglish\nperro\tdog\n');

            // Create Food folder (should be excluded)
            const foodDir = path.join(testDataDir, 'Food');
            const fruitsDir = path.join(foodDir, 'fruits');
            fs.mkdirSync(fruitsDir, { recursive: true });

            const fruitsFile = path.join(fruitsDir, 'fruits.tsv');
            fs.writeFileSync(fruitsFile, 'spanish\tenglish\nmanzana\tapple\n');

            // Create Spanish_Verbs folder (should be excluded)
            const verbsDir = path.join(testDataDir, 'Spanish_Verbs');
            fs.mkdirSync(verbsDir, { recursive: true });

            const regularFile = path.join(verbsDir, 'regular.tsv');
            fs.writeFileSync(regularFile, 'spanish\tenglish\nhablar\tto speak\n');

            // Target only Animals folder
            const files = findTSVFiles(testDataDir, '', 'Animals');

            expect(files).toHaveLength(1);
            expect(files[0].fileName).toBe('pets');
            expect(files[0].deckPath).toBe('Animals/domestic');
        });
    });

    describe('Edge Cases', () => {
        test('should handle target folder with special characters', () => {
            const specialDir = path.join(testDataDir, 'Folder With Spaces-Hyphens');
            fs.mkdirSync(specialDir, { recursive: true });

            const specialFile = path.join(specialDir, 'special.tsv');
            fs.writeFileSync(specialFile, 'spanish\tenglish\nespecial\tspecial\n');

            const files = findTSVFiles(testDataDir, '', 'Folder With Spaces-Hyphens');

            expect(files).toHaveLength(1);
            expect(files[0].deckPath).toBe('Folder With Spaces-Hyphens');
        });

        test('should handle case-sensitive folder names', () => {
            // Create only the "Animals" folder (uppercase)
            const animalsDir = path.join(testDataDir, 'Animals');
            fs.mkdirSync(animalsDir, { recursive: true });

            const testFile = path.join(animalsDir, 'test.tsv');
            fs.writeFileSync(testFile, 'spanish\tenglish\nalto\thigh\n');

            // Should find the exact match "Animals"
            const files = findTSVFiles(testDataDir, '', 'Animals');

            expect(files).toHaveLength(1);
            expect(files[0].fileName).toBe('test');
            expect(files[0].deckPath).toBe('Animals');
            
            // Should NOT find "animals" (lowercase) when it doesn't exist
            const filesLower = findTSVFiles(testDataDir, '', 'animals');
            expect(filesLower).toHaveLength(0);
        });
    });
});
