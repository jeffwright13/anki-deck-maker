# Anki Deck Maker - Spanish Glossaries

A Node.js tool to generate Anki flashcard decks from Spanish glossary files. Creates properly structured decks with Recognition (ES→EN) and Production (EN→ES) cards organized in nested subdecks.

## Features

- 📚 **Glossary Processing**: Transcribes and normalizes glossary screenshots into TSV format
- 🎴 **Dual Card Types**: Recognition (Spanish → English) and Production (English → Spanish)
- 🗂️ **Hierarchical Deck Structure**: Up to 5 levels of nesting based on folder structure in `data/` directory
- 🎯 **Direction Indicators**: Clear "ES → EN" / "EN → ES" labels on every card
- ✅ **Quality Assurance**: Automated QA scanning for typos, empty translations, and duplicates
- 📦 **Anki Compatible**: Generates proper `.apkg` files with full database schema

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd anki-deck-maker

# Install dependencies
npm install
```

### Usage

1. **Organize glossary files** in `data/` directory using folder hierarchy:
   ```
   data/
   ├── animals/
   │   ├── domestic/
   │   │   ├── pets.tsv
   │   │   └── farm.tsv
   │   └── wild/
   │       └── forest.tsv
   ├── food/
   │   ├── fruits.tsv
   │   └── vegetables.tsv
   └── verbs/
       ├── regular.tsv
       └── irregular.tsv
   ```

   This should result in the following decks:
   - animals
   - food
   - verbs

2. **Format TSV files** with Spanish and English columns:
   ```
   spanish	english
   perro	dog
   gato	cat
   ```

3. **Generate Anki deck**:
   ```bash
   node generate-decks.js
   ```

   **Targeted Generation** (optional):
   ```bash
   # Generate only specific folder
   node generate-decks.js Animals
   node generate-decks.js Food
   ```

   **Or use npm script**:
   ```bash
   npm run generate
   npm run generate -- Animals
   ```

4. **Import into Anki**:
   - Open Anki
   - File → Import
   - Select `output/Spanish-Vocabulary-Hierarchical.apkg`

## Project Structure

```
anki-deck-maker/
├── data/                    # Glossary TSV files
│   ├── glossary1.txt
│   ├── glossary2.txt
│   ├── glossary3.txt
│   ├── glossary4.txt
│   └── glossary5.txt
├── lib/                     # Core library files
│   └── anki-generator.js    # Anki .apkg generation engine
├── debug/                   # Debug files (safe from deletion)
│   └── generated-cards.json
├── output/                  # Generated .apkg files
│   ├── Animals.apkg
│   ├── Food.apkg
│   └── Spanish-Vocabulary-Hierarchical.apkg
├── generate-decks.js        # Main generation script
├── package.json
└── README.md
```

## Glossary Format

Glossary files should be TSV (tab-separated values) with the following format:

```tsv
spanish	english
hola	hello
adiós	goodbye
buenos días	good morning
```

**Requirements:**
- Header row: `spanish<TAB>english`
- Spanish terms: lowercase (accents preserved), trimmed
- English terms: case preserved, trimmed
- No blank lines
- One entry per line

## Generated Deck Structure

The tool creates separate top-level decks named after your top-level folders, with hierarchical subdecks:

```
Animals
├── domestic
│   ├── pets
│   │   ├── Recognition (Spanish → English)
│   │   └── Production (English → Spanish)
│   └── farm
│       ├── Recognition (Spanish → English)
│       └── Production (English → Spanish)
└── wild
    └── forest
        ├── Recognition (Spanish → English)
        └── Production (English → Spanish)

Food
├── fruits
│   ├── Recognition (Spanish → English)
│   └── Production (English → Spanish)
└── vegetables
    ├── Recognition (Spanish → English)
    └── Production (English → Spanish)

Spanish_Verbs
├── regular
│   ├── Recognition (Spanish → English)
│   └── Production (English → Spanish)
└── irregular
    ├── Recognition (Spanish → English)
    └── Production (English → Spanish)

Spanish Glossaries (for files in root data/ directory)
├── Recognition (Spanish → English)
└── Production (English → Spanish)
```

**Features:**
- **Multiple top-level decks** - Each top-level folder becomes a separate deck
- **Up to 5 levels** of nesting supported
- **Folder hierarchy** directly maps to deck hierarchy
- **Recognition/Production** subdecks automatically created for each TSV file
- **Flexible naming** - use any folder structure that works for you

## Card Design

Each card includes:
- **Direction indicator**: "ES → EN" or "EN → ES" (small, italic, gray)
- **Question**: Main vocabulary term
- **Answer**: Translation

### Example Cards

**Recognition Card (ES → EN):**
```
ES → EN

hola
─────
hello
```

**Production Card (EN → ES):**
```
EN → ES

hello
─────
hola
```

## Development

### Dependencies
- `sql.js` - SQLite database creation
- `jszip` - .apkg file generation
- `jest` - Unit testing framework

### Core Components

1. **`generate-decks.js`** - Main script that:
   - Reads glossary TSV files
   - Generates card data
   - Orchestrates .apkg creation

2. **`lib/anki-generator.js`** - Anki database engine that:
   - Creates proper SQLite schema
   - Handles deck hierarchy
   - Generates .apkg files

### Testing

The project includes comprehensive unit tests for the hierarchical deck naming feature:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch
```

#### Test Coverage

- **Hierarchical Deck Naming** (`tests/hierarchical-deck-naming.test.js`):
  - Folder structure detection
  - Deck naming conventions
  - File type filtering
  - Deep nesting support (5 levels)
  - Integration tests

- **AnkiGenerator** (`tests/anki-generator.test.js`):
  - Deck structure creation
  - Note type configuration
  - Database generation
  - Error handling

#### Test Structure

Tests cover:
- ✅ Root-level files → "Spanish Glossaries" deck
- ✅ Nested files → Top-level folder name as deck
- ✅ Deep nesting (up to 5 levels)
- ✅ Multiple top-level directories
- ✅ File type validation (.tsv, .txt only)
- ✅ Card generation with proper deck hierarchy
- ✅ Database creation with all required tables

## Quality Assurance

The tool includes automated QA checks:
- Empty Spanish/English fields
- Duplicate Spanish terms
- Suspicious translations (very short/long)
- OCR artifacts and formatting issues

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions, please create an issue in the repository.
