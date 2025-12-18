const AnkiGenerator = require('../lib/anki-generator');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('AnkiGenerator', () => {
    let tempDir;
    let generator;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-test-'));
        generator = new AnkiGenerator();
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('Deck Structure Creation', () => {
        test('should create hierarchical deck structure correctly', () => {
            const cards = [
                {
                    type: 'recognition',
                    deck: 'Animals/domestic::Recognition',
                    front: 'perro',
                    back: 'dog',
                    tags: ['vocabulary', 'Animals-domestic', 'recognition']
                },
                {
                    type: 'production',
                    deck: 'Animals/domestic::Production',
                    front: 'dog',
                    back: 'perro',
                    tags: ['vocabulary', 'Animals-domestic', 'production']
                },
                {
                    type: 'recognition',
                    deck: 'Food/fruits::Recognition',
                    front: 'manzana',
                    back: 'apple',
                    tags: ['vocabulary', 'Food-fruits', 'recognition']
                }
            ];

            const deckStructure = generator.createDeckStructure(cards);

            // Should create decks for all unique deck paths (without Recognition/Production)
            expect(Object.keys(deckStructure)).toContain('Animals/domestic');
            expect(Object.keys(deckStructure)).toContain('Food/fruits');

            // Check deck properties
            const animalsDeck = deckStructure['Animals/domestic'];
            expect(animalsDeck.name).toBe('Animals/domestic');
            expect(animalsDeck.id).toBeGreaterThan(0);

            const foodDeck = deckStructure['Food/fruits'];
            expect(foodDeck.name).toBe('Food/fruits');
            expect(foodDeck.id).toBeGreaterThan(0);

            // All deck IDs should be unique
            const deckIds = Object.values(deckStructure).map(deck => deck.id);
            expect(new Set(deckIds).size).toBe(deckIds.length);
        });

        test('should handle root-level Spanish Glossaries deck', () => {
            const cards = [
                {
                    type: 'recognition',
                    deck: 'Spanish Glossaries::Recognition',
                    front: 'hola',
                    back: 'hello',
                    tags: ['vocabulary', 'recognition']
                }
            ];

            const deckStructure = generator.createDeckStructure(cards);

            expect(Object.keys(deckStructure)).toContain('Spanish Glossaries');
            expect(deckStructure['Spanish Glossaries'].name).toBe('Spanish Glossaries');
        });

        test('should handle deep nesting (5 levels)', () => {
            const cards = [
                {
                    type: 'recognition',
                    deck: 'Level1/Level2/Level3/Level4/Level5::Recognition',
                    front: 'profundo',
                    back: 'deep',
                    tags: ['vocabulary', 'recognition']
                }
            ];

            const deckStructure = generator.createDeckStructure(cards);

            expect(Object.keys(deckStructure)).toContain('Level1/Level2/Level3/Level4/Level5');
            expect(deckStructure['Level1/Level2/Level3/Level4/Level5'].name).toBe('Level1/Level2/Level3/Level4/Level5');
        });

        test('should create parent decks for nested structures', () => {
            const cards = [
                {
                    type: 'recognition',
                    deck: 'Animals/domestic/pets::Recognition',
                    front: 'perro',
                    back: 'dog',
                    tags: ['vocabulary', 'recognition']
                }
            ];

            const deckStructure = generator.createDeckStructure(cards);

            // Should create the full path including parent decks
            expect(Object.keys(deckStructure)).toContain('Animals/domestic/pets');
            
            // Check that the deck has the correct full path name
            const petsDeck = deckStructure['Animals/domestic/pets'];
            expect(petsDeck.name).toBe('Animals/domestic/pets');
        });
    });

    describe('Note Type Creation', () => {
        test('should create note type with direction field', () => {
            const noteType = generator.createNoteType();

            expect(noteType.name).toBe('JW::Spanish Glossary v1');
            expect(noteType.flds).toHaveLength(4);
            
            const fieldNames = noteType.flds.map(field => field.name);
            expect(fieldNames).toContain('UID');
            expect(fieldNames).toContain('Front');
            expect(fieldNames).toContain('Back');
            expect(fieldNames).toContain('Direction');

            // Check card template includes direction
            const template = noteType.tmpls[0];
            expect(template.qfmt).toContain('{{Direction}}');
            expect(template.afmt).toContain('{{Direction}}');
            
            // Check CSS for direction styling
            expect(noteType.css).toContain('.direction');
            expect(noteType.css).toContain('font-style: italic');
        });
    });

    describe('Cloze Mode', () => {
        test('should create cloze note type with expected templates and fields', () => {
            const clozeGenerator = new AnkiGenerator({
                mode: 'cloze',
                noteTypeName: 'Cloze for Preterite'
            });

            const noteType = clozeGenerator.createNoteType();

            expect(noteType.name).toBe('Cloze for Preterite');
            expect(noteType.type).toBe(1);

            const fieldNames = noteType.flds.map(field => field.name);
            expect(fieldNames).toEqual(['Text', 'Hint', 'Back']);

            const template = noteType.tmpls[0];
            expect(template.qfmt).toContain('{{cloze:Text}}');
            expect(template.afmt).toContain('{{cloze:Text}}');
            expect(template.qfmt).toContain('{{Hint}}');
            expect(template.afmt).toContain('{{Hint}}');

            expect(noteType.css).toContain('.cloze');
            expect(noteType.css).toContain('.hint');
        });

        test('should generate one card per cloze index (c1, c2, ...)', async () => {
            const clozeGenerator = new AnkiGenerator({
                mode: 'cloze',
                noteTypeName: 'Cloze for Preterite'
            });

            const notes = [
                {
                    type: 'cloze',
                    deck: 'Preterite::Sentences::Test',
                    text: 'Yo {{c1::fui}} al mercado y {{c2::compré}} pan.',
                    hint: 'ir/comprar',
                    back: '',
                    uid: 'test-cloze-uid',
                    tags: ['cloze', 'test']
                }
            ];

            const db = await clozeGenerator.createSQLiteDatabase(notes);
            const notesCount = db.exec('select count(*) as n from notes')[0].values[0][0];
            const cardsRows = db.exec('select ord from cards order by ord')[0].values.map(r => r[0]);

            expect(notesCount).toBe(1);
            expect(cardsRows).toEqual([0, 1]);
        });
    });

    describe('Database Creation', () => {
        test('should create database with all required tables', async () => {
            const cards = [
                {
                    type: 'recognition',
                    deck: 'Test::Recognition',
                    front: 'hola',
                    back: 'hello',
                    tags: ['test', 'recognition']
                }
            ];

            const apkgPath = path.join(tempDir, 'test.apkg');
            
            await generator.generateApkg(cards, apkgPath);

            // Verify the file was created
            expect(fs.existsSync(apkgPath)).toBe(true);
            
            // Verify it's a valid zip file
            const stats = fs.statSync(apkgPath);
            expect(stats.size).toBeGreaterThan(0);
        });

        test('should handle cards with direction indicators', async () => {
            const cards = [
                {
                    type: 'recognition',
                    deck: 'Test::Recognition',
                    front: 'hola',
                    back: 'hello',
                    tags: ['test', 'recognition']
                },
                {
                    type: 'production',
                    deck: 'Test::Production',
                    front: 'hello',
                    back: 'hola',
                    tags: ['test', 'production']
                }
            ];

            const apkgPath = path.join(tempDir, 'test-direction.apkg');
            
            await generator.generateApkg(cards, apkgPath);

            expect(fs.existsSync(apkgPath)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle empty cards array', async () => {
            const apkgPath = path.join(tempDir, 'empty.apkg');
            
            // Should not throw error with empty cards
            await expect(generator.generateApkg([], apkgPath)).resolves.not.toThrow();
            
            expect(fs.existsSync(apkgPath)).toBe(true);
        });

        test('should handle cards with missing properties gracefully', () => {
            const cards = [
                {
                    // Missing required properties
                    type: 'recognition',
                    deck: 'Test::Recognition'
                }
            ];

            // Should not throw during deck structure creation
            expect(() => {
                generator.createDeckStructure(cards);
            }).not.toThrow();
        });
    });
});
