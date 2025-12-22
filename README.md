# Anki Deck Maker - Universal Flashcard Generator

A Node.js tool to generate Anki flashcard decks from TSV glossary files. Creates properly structured decks with Recognition (listening/reading) and Production (speaking/writing) cards for any language pair or topic, organized in nested subdecks based on your folder structure.

## Features

- 📚 **Flexible Content**: Process any TSV files with question/answer pairs for any topic or language
- 🎴 **Dual Card Types**: Recognition (Term1 → Term2) and Production (Term2 → Term1)
- 🗂️ **Hierarchical Deck Structure**: Up to 5 levels of nesting based on folder structure in `data/` directory
- 🎯 **Clear Direction**: Automatic labeling showing the direction of each card type
- ✅ **Quality Assurance**: Automated validation for proper formatting and completeness
- 📦 **Anki Compatible**: Generates proper `.apkg` files with full database schema

## Cloze Mode

In addition to glossary (front/back) cards, the generator supports **Cloze** notes from TSV files.

### Cloze TSV Format

Each non-empty line must be tab-separated:

```tsv
Text	Hint
```

Or with an explicit stable row id:

```tsv
id	Text	Hint
```

- `Text`: must include one or more cloze deletions like `{{c1::...}}`, `{{c2::...}}`, etc.
- `Hint`: small italic hint text displayed above the cloze sentence.

### Generating a Cloze Deck

Place your cloze TSV files anywhere under `data/` (nested folders become nested decks), then run:

```bash
node generate-decks.js <TopLevelFolder> --cloze
```

Example:

```bash
node generate-decks.js Preterite --cloze
```

This writes:
- `output/Preterite-cloze.apkg`

Notes:
- The generated note type name is `Cloze for <TopLevelFolder>`.
- Each TSV row becomes a single note; Anki will generate one card per cloze index present in `Text`.

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

1. **Organize your content** in the `data/` directory using your desired folder hierarchy:
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

   After import, this should result in 3 decks, with sub-decks, as follows:
   - animals (no cards)
     - domestic (no cards)
       - pets
         - Recognition (cards)
         - Production (cards)
       - farm
         - Recognition (cards)
         - Production (cards)
     - wild (no cards)
       - forest
         - Recognition (cards)
         - Production (cards)
   - food (no cards)
     - fruits
       - Recognition (cards)
       - Production (cards)
     - vegetables
       - Recognition (cards)
       - Production (cards)
   - verbs (cards)
     - regular (cards)
     - irregular (cards)

2. **Format TSV files** with your two languages/topics (see detailed TSV format section below):

3. **Generate Anki deck**:

   **Direct Node.js execution (recommended):**
   ```bash
   # New (preferred) interface
   node generate-decks.js --mode glossary
   node generate-decks.js --mode glossary --folder "animals"
   node generate-decks.js --mode glossary --folder "animals" --direction-labels
   node generate-decks.js --mode cloze --folder "Preterite"

   # Backward-compatible interface
   # Generate cards for all folders WITHOUT direction labels (default)
   node generate-decks.js

   # Generate cards for specific folder WITHOUT direction labels
   node generate-decks.js "animals"

   # Generate cards WITH direction labels (requires header row)
   node generate-decks.js --direction-labels
   node generate-decks.js -d
   node generate-decks.js "animals" --direction-labels

   # Generate CLOZE notes from TSV rows formatted as Text<TAB>Hint
   node generate-decks.js "Preterite" --cloze
   ```

   **Using npm script:**
   ```bash
   npm run generate
   npm run generate -- animals
   ```

   **Show help:**
   ```bash
   node generate-decks.js --help
   node generate-decks.js -h
   ```

4. **Import into Anki**:
   - Open Anki
   - File → Import
   - Select `output/Your-Topic-Folder.apkg` (or appropriate filename)

## Command Line Options

The script supports several command line options for flexible usage:

### Basic Usage
```bash
node generate-decks.js [folder-name] [options]
```

### Arguments
- **folder-name** (optional): Generate cards only for a specific top-level folder in the `data/` directory
  - If omitted, processes all folders
  - Use quotes for folder names with spaces: `"Spanish Stories"`

### Options
- `--help, -h`: Show detailed help message and usage examples
- `--mode, -m`: Select generation mode: glossary (default) or cloze
- `--folder, -f`: Restrict generation to a specific top-level folder under data/
  - Use quotes for folder names with spaces: `--folder "Phonological Clusters"`
- `--direction-labels, -d`: Enable direction labels on cards (e.g., "ES → EN")
  - **REQUIRES**: First row in TSV must contain labels
  - **Default**: Direction labels are DISABLED (safer, prevents lost cards)
- `--cloze`: Legacy alias for: --mode cloze

### Examples
```bash
# Process all folders WITHOUT direction labels (default)
node generate-decks.js

# Process specific folder WITHOUT direction labels
node generate-decks.js animals
node generate-decks.js --folder animals
node generate-decks.js --folder "Spanish Stories"

# Process WITH direction labels (requires header row)
node generate-decks.js --direction-labels
node generate-decks.js -d
node generate-decks.js animals --direction-labels
node generate-decks.js --folder animals --direction-labels
node generate-decks.js --folder "Phonological Clusters" -d

# Process CLOZE notes from TSV rows formatted as Text<TAB>Hint
node generate-decks.js "Preterite" --cloze
node generate-decks.js --folder "Preterite" --mode cloze

# Show help
node generate-decks.js --help
```

### Output
- Generated `.apkg` files are saved to the `output/` directory
- Debug information is saved to `debug/generated-cards.json`
- Console output shows progress and statistics

## Project Structure

```
anki-deck-maker/
├── data/                    # Your TSV files
│   ├── topic1/
│   │   ├── basic.tsv
│   │   └── advanced.tsv
│   ├── topic2/
│   │   └── vocabulary.tsv
│   └── topic3.tsv
├── lib/                     # Core library files
│   └── anki-generator.js    # Anki .apkg generation engine
├── debug/                   # Debug files (safe from deletion)
│   └── generated-cards.json
├── output/                  # Generated .apkg files
│   ├── topic1.apkg
│   ├── topic2.apkg
│   └── Your-Topic-Folder.apkg
├── generate-decks.js        # Main generation script
├── package.json
└── README.md
```

## TSV File Format

Your content files should be TSV (tab-separated values) with the following format:

```tsv
spanish	english
hello	hola
goodbye	adiós
```

### File Requirements
- **File Extension**: `.tsv` or `.txt`
- **Encoding**: UTF-8 (essential for special characters)
- **Header row**: `Label1<TAB>Label2` - **OPTIONAL**, only needed for direction labels
- **Data rows**: One entry per line with tab separator
- **First column**: Your first language/topic (lowercase recommended, accents preserved)
- **Second column**: Your second language/topic (case preserved)
- No blank lines

### Header Row Function (Optional)
The header row defines the direction labels that appear on each card when using the `--direction-labels` flag:
- **Recognition cards** display: "Label1 → Label2"
- **Production cards** display: "Label2 → Label1"

**Important**: Header row is only required when using `--direction-labels`. Without this flag, the header row is ignored.

### Language Pair Examples
```tsv
# Spanish → English
spanish	english
hola	hello
adiós	goodbye

# French → English
français	english
bonjour	hello
au revoir	goodbye

# Term → Definition
term	definition
photosynthesis	process by which plants make food
```

### Content Guidelines
- **Base forms**: Use verb infinitives ("to eat", not "eating")
- **No articles**: Use "house", not "the house" (unless essential)
- **Multiple meanings**: Use slash separator ("house/home")
- **Context hints**: Add brief parenthetical notes when needed
- **Special characters**: Include proper accents (á, é, í, ó, ú, ñ, etc.)

## Generated Deck Structure

The tool creates separate top-level decks named after your top-level folders, with hierarchical subdecks. Each TSV file generates two subdecks:

```
Topic1
├── basic
│   ├── Recognition (Term1 → Term2)
│   └── Production (Term2 → Term1)
└── advanced
    ├── Recognition (Term1 → Term2)
    └── Production (Term2 → Term1)

Topic2
└── vocabulary
    ├── Recognition (Term1 → Term2)
    └── Production (Term2 → Term1)

Root Level Files (for files directly in data/ directory)
├── Recognition (Term1 → Term2)
└── Production (Term2 → Term1)
```

**Features:**
- **Multiple top-level decks** - Each top-level folder becomes a separate deck
- **Up to 5 levels** of nesting supported
- **Folder hierarchy** directly maps to deck hierarchy
- **Recognition/Production** subdecks automatically created for each TSV file
- **Flexible naming** - use any folder structure that works for you

## Card Design

Each card includes:
- **Direction indicator**: "Term1 → Term2" or "Term2 → Term1" (small, italic, gray)
- **Question**: Main vocabulary term
- **Answer**: Translation or corresponding term

### Example Cards

**Recognition Card (Term1 → Term2):**
```
Term1 → Term2

hola
─────
hello
```

**Production Card (Term2 → Term1):**
```
Term2 → Term1

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
   - Reads TSV files from data/ directory
   - Generates card data for both directions
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
- ✅ Root-level files → Root level deck
- ✅ Nested files → Top-level folder name as deck
- ✅ Deep nesting (up to 5 levels)
- ✅ Multiple top-level directories
- ✅ File type validation (.tsv, .txt only)
- ✅ Card generation with proper deck hierarchy
- ✅ Database creation with all required tables

## Quality Assurance

The tool includes automated validation checks:
- Empty fields in either column
- Duplicate terms in first column
- Formatting issues and irregularities
- File structure validation

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
