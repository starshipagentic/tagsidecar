# tagsidecar

Sidecar metadata file management for developers who work in frenzies.

## What is tagsidecar?

tagsidecar is a CLI tool that helps you manage metadata for your experimental projects using special Greek-character-prefixed markdown files:

- **∑ship.md** - Project metadata (tags, fleets, purpose)
- **∫terminal.md** - Terminal session configurations
- **∆captainslog.md** - Developer insights and discoveries

Perfect for developers who create multiple experimental folders and need to track, tag, and organize them.

## Installation

```bash
npm install -g tagsidecar
```

## Quick Start

### 1. Initialize a Ship (Project)

```bash
cd my-project
tagsidecar ship init
```

This creates a `∑ship.md` file with metadata.

### 2. Add Tags

```bash
tagsidecar add nodejs cli experimental
```

### 3. Organize into Fleets

```bash
tagsidecar fleet ai-experiments --rank 5 --star "⭐"
```

### 4. Discover All Ships

```bash
cd ~/projects
tagsidecar discover
```

## Commands

### Ship Commands

```bash
# Initialize ship
tagsidecar ship init

# Add tags (shortcut: tagsidecar add <tags...>)
tagsidecar ship add-tag nodejs cli experimental

# Remove tags (shortcut: tagsidecar remove <tags...>)
tagsidecar ship remove-tag experimental

# Add to fleet
tagsidecar ship fleet-add ai-experiments --rank 5 --star "⭐" --role leader
# Shortcut: tagsidecar fleet <fleet> --rank 5 --star "⭐"

# Remove from fleet
tagsidecar ship fleet-remove ai-experiments

# Update ship info
tagsidecar ship update --shipname "uss-enterprise" --purpose "Production API" --status active
```

### Captain's Log Commands

```bash
# Initialize captain's log
tagsidecar captainslog init

# Add log entry
tagsidecar captainslog add "Discovered ripgrep performance fix" --type breakthrough --impact high

# Types: breakthrough, discovery, fix, refactor, learning
# Impact: critical, high, medium, low
```

### Terminal Commands

```bash
# Initialize terminal session
tagsidecar terminal init

# Add room with command
tagsidecar terminal add dev --command "npm run dev"
tagsidecar terminal add test --command "npm test" --folder ./tests

# Restore terminal session (shows commands to run)
tagsidecar terminal restore
```

### Search & Discovery

```bash
# Search across all Greek-char .md files
tagsidecar search nodejs
tagsidecar search "performance fix"

# Discover all ships in subdirectories
tagsidecar discover
```

## File Formats

### ∑ship.md

```yaml
---
shipname: my-project
purpose: Experimental API wrapper
tech_stack: [nodejs, express]
status: active
created: '2025-10-07'
tags:
  - api
  - experimental
fleets:
  - name: ai-fleet
    rank: 5
    star: ⭐
    role: member
commands: {}
---
# my-project

Project documentation here.
```

### ∆captainslog.md

```yaml
---
ship: my-project
topics: [performance, optimization]
entries:
  - date: '2025-10-07'
    stardate: '2025.279'
    type: breakthrough
    impact: high
    title: Discovered ripgrep fix
---

## 2025-10-07 - Discovered ripgrep fix [HIGH IMPACT]

**Type:** breakthrough

Details about the discovery...

---
# Captain's Log: my-project
```

### ∫terminal.md

```yaml
---
session_name: default
last_active: '2025-10-07T01:27:59.147Z'
rooms:
  - name: dev
    description: ''
    folder: .
    command: npm run dev
    autostart: true
  - name: test
    description: ''
    folder: ./tests
    command: npm test
    autostart: true
---
# Terminal Session: default
```

## Use Cases

### Scenario A: Frenzy Development

You create 5 experimental folders trying different approaches. Use tagsidecar to:

1. Tag each with relevant keywords
2. Group related experiments into fleets
3. Search across all to find "that project where you tried X"
4. Capture insights in captain's log

### Scenario B: Terminal Session Management

You have a project with multiple terminal tabs:

1. `tagsidecar terminal init`
2. `tagsidecar terminal add dev --command "npm run dev"`
3. `tagsidecar terminal add api --command "npm run api" --folder ./api`
4. When switching contexts: `tagsidecar terminal restore`

### Scenario C: Knowledge Capture

You discover something important while coding:

```bash
tagsidecar captainslog add "Ripgrep needs --glob=!Pictures/ to avoid macOS errors" \
  --type breakthrough --impact high
```

Later, search for it:

```bash
tagsidecar search ripgrep
```

## Fleet System

- **Rank**: 0 to ∞ (higher = more important, 0 = default)
- **Star**: Single emoji (⭐ 💫 🌟 etc.)
- **Role**: member, leader, contributor, etc.

Ships can belong to multiple fleets with different ranks.

## Greek Characters

The tool uses Greek characters to make metadata files visually distinct:

- **∑** (Sigma) - Sum/Collection → Ship metadata
- **∫** (Integral) - Integration → Terminal integration
- **∆** (Delta) - Change → Captain's log of changes/discoveries

Type them with:
- Mac: Character Viewer (Ctrl+Cmd+Space)
- Or use the init commands which create the files automatically

## Library Usage

You can also import tagsidecar as a library:

```javascript
const { shipInit, shipAddTag, searchAll } = require('tagsidecar');

// Initialize ship
await shipInit({ shipname: 'my-project', purpose: 'Testing' });

// Add tags
await shipAddTag(['nodejs', 'cli']);

// Search
const results = await searchAll('nodejs');
```

## License

MIT

## Author

starshipagentic
