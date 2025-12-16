# LLM Instructions: Creating TSV Files for Anki Deck Generator

## Your Task
Create tab-separated value (.tsv) files containing vocabulary pairs for generating bilingual Anki flashcards. The system will automatically create both Recognition (Language1→Language2) and Production (Language2→Language1) cards.

## File Format Requirements

### Basic Structure
- **File Extension**: `.tsv` or `.txt`
- **Encoding**: UTF-8 (essential for special characters)
- **Header**: Required first line with two language/topic labels: `Label1<TAB>Label2`
- **Delimiter**: Tab character (`\t`) between the two languages
- **Line Ending**: Unix-style (`\n`)

### File Format Example
```tsv
spanish	english
hello	hola
house	casa
to eat	comer
water	agua
```

### Header Row Function
The header row defines the direction labels that appear on each card:
- **Recognition cards** show: "Label1 → Label2" 
- **Production cards** show: "Label2 → Label1"

**Examples:**
- `spanish	english` → Recognition: "spanish → english", Production: "english → spanish"
- `francais	english` → Recognition: "francais → english", Production: "english → francais"
- `term	definition` → Recognition: "term → definition", Production: "definition → term"

## Directory Structure for Organization

### Standard Organization
```
data/
├── Your-Topic-Folder/
│   ├── basic-vocabulary.tsv
│   ├── phrases.tsv
│   └── advanced-terms.tsv
└── Another-Topic/
    └── glossary.tsv
```

### Deck Naming Rules
- **Top-level folder** becomes main deck name (e.g., "Your-Topic-Folder")
- **Filename** becomes subdeck name (e.g., "basic-vocabulary")
- **Final structure**: "Your-Topic-Folder::basic-vocabulary::Recognition"

## Content Guidelines

### Language 1 Side Requirements
- **No articles** unless essential (use `house`, not `the house`)
- **Base form** for verbs (infinitive: `to eat`, not `eating`)
- **Proper accents and special characters** (á, é, í, ó, ú, ñ, ¿, ¡, etc.)
- **Capitalization**: Sentence case for nouns, lowercase for verbs
- **No punctuation** unless part of the term

### Language 2 Side Requirements
- **Clear, concise translations**
- **Include "to"** for English verb infinitives (`to eat`, not `eat`)
- **Multiple meanings**: Use slash separator (`house/home`, `to eat/to consume`)
- **Context hints**: Add brief parenthetical notes when needed

### Quality Standards
```tsv
term1	term2
# ✅ GOOD examples:
house	casa
dog	perro
to eat	comer
tomorrow	mañana

# ❌ AVOID:
the house	casa	# No articles
eating	to eat	# Use infinitive
house.	casa	# No punctuation
House	Casa	# Proper capitalization
```

## Topic-Specific Instructions

### For Vocabulary Topics (e.g., Food, Travel, Business)
```tsv
term1	term2
restaurant	restaurante
table	mesa
waiter	camarero/camarera
to order	pedir
bill/check	cuenta
```

### For Grammar Topics (e.g., Verbs, Prepositions)
```tsv
term1	term2
to be (permanent)	ser
to be (temporary)	estar
for (because of)	por
for (in order to)	para
```

### For Thematic Topics (e.g., Medical, Technical, Legal)
```tsv
term1	term2
meeting	reunión
project	proyecto
client	cliente/cliente
to report	informar
```

## Advanced Formatting Options

### Multiple Acceptable Answers
```tsv
term1	term2
car	auto/coche/carro
computer	ordenador/computadora
```

### Context-Specific Terms
```tsv
term1	term2
bank	banco (financial) / banco (bench)
pull	tirar / tira (comic strip)
```

### Phrasal Expressions
```tsv
term1	term2
to be hungry	tener hambre
it's hot (weather)	hace calor
please	por favor
```

## File Creation Process

### Step 1: Plan Your Vocabulary
- Define your topic scope clearly
- Group related terms logically
- Aim for 20-100 terms per file for optimal learning
- Consider difficulty progression (basic → intermediate → advanced)

### Step 2: Create the TSV File
1. Use any text editor (Notepad, VS Code, TextEdit, etc.)
2. Add header: `term1	term2`
3. Add each vocabulary pair on new line with tab separator
4. Save as UTF-8 encoded `.tsv` file

### Step 3: Quality Check
- Verify all special characters and accents are correct
- Check translations are accurate and natural
- Ensure no empty lines or extra spaces
- Test with the deck generator script

## Common Mistakes to Avoid

### Formatting Errors
```tsv
# ❌ WRONG - comma instead of tab
house,casa

# ❌ WRONG - space instead of tab
house casa

# ❌ WRONG - missing header
house	casa
dog	perro
```

### Content Errors
```tsv
# ❌ WRONG - conjugated verbs (use infinitives)
I speak	hablo

# ❌ WRONG - articles included
the dog	el perro

# ❌ WRONG - punctuation
house.	casa
```

## Testing Your Files

### Validation Process
1. Place files in appropriate `data/Your-Topic-Folder/` directory
2. Run the deck generator command
3. Check output for any warnings or errors
4. Verify card count matches expectations

### Expected Successful Output
```
📁 Found 1 glossary files in hierarchy:
  📄 basic-vocabulary → Your-Topic-Folder

📖 Reading basic-vocabulary...
  ✅ Found 25 entries
  🎴 Generated 50 cards (25 recognition + 25 production)
```

## Best Practices

### Content Organization
- **Group by difficulty**: Basic → Intermediate → Advanced
- **Group by category**: Nouns → Verbs → Adjectives → Phrases
- **Logical file naming**: `01-basic.tsv`, `02-intermediate.tsv`
- **Keep files manageable**: Under 500 terms each

### Translation Quality
- Use **common, everyday meanings** first
- Include **secondary meanings** with slashes
- Add **context clues** for ambiguous terms
- Maintain **consistency** in translation style
- Consider **regional variations** if relevant

### File Management
- Use **descriptive filenames**
- **Test frequently** during creation
- **Backup files** regularly
- **Document sources** if using external references

## Customization Options

### Language Pair Adaptation
- Change header to match your languages: `english	spanish`, `french	english`, etc.
- Adjust translation guidelines for specific language characteristics
- Consider grammatical gender, formality levels, or regional variations

### Advanced Features
- Add pronunciation guides in parentheses
- Include example sentences for context
- Create thematic series (e.g., "Restaurant Spanish", "Medical English")
- Develop progressive difficulty levels

## Final Output
This system will automatically generate both Recognition and Production cards for each term, organized in hierarchical Anki decks matching your folder structure. Each vocabulary pair creates two cards:
- **Recognition**: Language1 → Language2
- **Production**: Language2 → Language1

The generated .apkg file can be imported directly into Anki for immediate use in spaced repetition learning.

---

**Ready to proceed? Create your TSV files following these guidelines, then run the deck generator to create your Anki deck!**
