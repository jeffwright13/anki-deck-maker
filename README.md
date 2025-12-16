# Anki Deck Maker - Spanish Glossaries

A Node.js tool to generate Anki flashcard decks from Spanish glossary files. Creates properly structured decks with Recognition (ES→EN) and Production (EN→ES) cards organized in nested subdecks.

## Features

- 📚 **Glossary Processing**: Transcribes and normalizes glossary screenshots into TSV format
- 🎴 **Dual Card Types**: Recognition (Spanish → English) and Production (English → Spanish)
- 🗂️ **Nested Deck Structure**: Organized under `Short Spanish Stories A1::Glossaries` with subdecks for each glossary
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

1. **Prepare glossary files** in `data/` directory as TSV format:
   ```
   spanish	english
   hola	hello
   adiós	goodbye
   ```

2. **Generate Anki deck**:
   ```bash
   node generate-glossary-deck.js
   ```

3. **Import into Anki**:
   - Open Anki
   - File → Import
   - Select `output/Short-Spanish-Stories-A1-Glossaries.apkg`

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
├── output/                  # Generated files
│   ├── Short-Spanish-Stories-A1-Glossaries.apkg
│   └── generated-cards.json
├── generate-glossary-deck.js # Main generation script
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

The tool creates a nested deck structure:

```
Short Spanish Stories A1::Glossaries
├── Glossary 1
│   ├── Recognition (Spanish → English)
│   └── Production (English → Spanish)
├── Glossary 2
│   ├── Recognition (Spanish → English)
│   └── Production (English → Spanish)
├── Glossary 3
│   ├── Recognition (Spanish → English)
│   └── Production (English → Spanish)
├── Glossary 4
│   ├── Recognition (Spanish → English)
│   └── Production (English → Spanish)
└── Glossary 5
    ├── Recognition (Spanish → English)
    └── Production (English → Spanish)
```

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

### Core Components

1. **`generate-glossary-deck.js`** - Main script that:
   - Reads glossary TSV files
   - Generates card data
   - Orchestrates .apkg creation

2. **`lib/anki-generator.js`** - Anki database engine that:
   - Creates proper SQLite schema
   - Handles deck hierarchy
   - Generates .apkg files

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
