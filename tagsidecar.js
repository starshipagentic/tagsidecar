#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { execSync } = require('child_process');
const os = require('os');

const program = new Command();

// Greek characters for file pattern matching
const GREEK_CHARS = ['∑', '∫', '∆', 'ß', 'π', 'Ω', '˚', '†'];
const SHIP_FILE = '∑ship.md';
const TERMINAL_FILE = '∫terminal.md';
const CAPTAINSLOG_FILE = '∆captainslog.md';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function readMetadataFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return matter(content);
}

function writeMetadataFile(filePath, data, markdown) {
  const content = matter.stringify(markdown, data);
  fs.writeFileSync(filePath, content, 'utf8');
}

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentStardate() {
  const now = new Date();
  const year = now.getFullYear();
  const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / 1000 / 60 / 60 / 24);
  return `${year}.${dayOfYear}`;
}

// ============================================================================
// SHIP COMMANDS
// ============================================================================

function shipInit(options) {
  const shipPath = path.join(process.cwd(), SHIP_FILE);

  if (fs.existsSync(shipPath) && !options.force) {
    console.error(`✗ ${SHIP_FILE} already exists. Use --force to overwrite.`);
    process.exit(1);
  }

  const data = {
    shipname: options.shipname || path.basename(process.cwd()),
    purpose: options.purpose || 'Project purpose',
    tech_stack: [],
    status: 'active',
    created: getCurrentDate(),
    tags: [],
    fleets: [],
    commands: {}
  };

  const markdown = `# ${data.shipname}\n\n${data.purpose}\n\n## Getting Started\n\nAdd your documentation here.\n`;

  writeMetadataFile(shipPath, data, markdown);
  console.log(`✓ Created ${SHIP_FILE}`);
}

function shipAddTag(tags, options) {
  const shipPath = path.join(process.cwd(), SHIP_FILE);
  const parsed = readMetadataFile(shipPath);

  if (!parsed) {
    console.error(`✗ ${SHIP_FILE} not found. Run 'tagsidecar ship init' first.`);
    process.exit(1);
  }

  const existingTags = ensureArray(parsed.data.tags);
  const newTags = [...new Set([...existingTags, ...tags])];
  parsed.data.tags = newTags;

  writeMetadataFile(shipPath, parsed.data, parsed.content);
  console.log(`✓ Added tags: ${tags.join(', ')}`);
  console.log(`  All tags: ${newTags.join(', ')}`);
}

function shipRemoveTag(tags, options) {
  const shipPath = path.join(process.cwd(), SHIP_FILE);
  const parsed = readMetadataFile(shipPath);

  if (!parsed) {
    console.error(`✗ ${SHIP_FILE} not found.`);
    process.exit(1);
  }

  const existingTags = ensureArray(parsed.data.tags);
  const remainingTags = existingTags.filter(tag => !tags.includes(tag));
  parsed.data.tags = remainingTags;

  writeMetadataFile(shipPath, parsed.data, parsed.content);
  console.log(`✓ Removed tags: ${tags.join(', ')}`);
  console.log(`  Remaining tags: ${remainingTags.join(', ')}`);
}

function shipFleetAdd(fleetName, options) {
  const shipPath = path.join(process.cwd(), SHIP_FILE);
  const parsed = readMetadataFile(shipPath);

  if (!parsed) {
    console.error(`✗ ${SHIP_FILE} not found.`);
    process.exit(1);
  }

  const fleets = ensureArray(parsed.data.fleets);

  // Check if fleet already exists
  const existingFleet = fleets.find(f => f.name === fleetName);
  if (existingFleet) {
    // Update existing
    existingFleet.rank = options.rank !== undefined ? parseInt(options.rank) : existingFleet.rank;
    existingFleet.star = options.star || existingFleet.star;
    existingFleet.role = options.role || existingFleet.role;
    console.log(`✓ Updated fleet: ${fleetName}`);
  } else {
    // Add new
    fleets.push({
      name: fleetName,
      rank: options.rank !== undefined ? parseInt(options.rank) : 0,
      star: options.star || null,
      role: options.role || 'member'
    });
    console.log(`✓ Added to fleet: ${fleetName}`);
  }

  parsed.data.fleets = fleets;
  writeMetadataFile(shipPath, parsed.data, parsed.content);

  if (options.star) {
    console.log(`  Rank: ${options.rank || 0}, Star: ${options.star}`);
  } else {
    console.log(`  Rank: ${options.rank || 0}`);
  }
}

function shipShow() {
  const shipPath = path.join(process.cwd(), SHIP_FILE);
  const parsed = readMetadataFile(shipPath);

  if (!parsed) {
    console.error(`✗ ${SHIP_FILE} not found.`);
    process.exit(1);
  }

  console.log(`\nShip: ${parsed.data.shipname || 'Unnamed'}`);
  console.log(`Purpose: ${parsed.data.purpose || 'N/A'}`);
  console.log(`Status: ${parsed.data.status || 'unknown'}`);
  console.log(`Tags: ${(parsed.data.tags || []).join(', ') || 'none'}`);

  if (parsed.data.fleets && parsed.data.fleets.length > 0) {
    console.log(`\nFleets:`);
    parsed.data.fleets.forEach(fleet => {
      const star = fleet.star || '';
      console.log(`  - ${fleet.name} ${star} (Rank: ${fleet.rank || 0}, Role: ${fleet.role || 'member'})`);
    });
  }

  console.log('');
}

// ============================================================================
// CAPTAINSLOG COMMANDS
// ============================================================================

function captainslogInit(options) {
  const logPath = path.join(process.cwd(), CAPTAINSLOG_FILE);

  if (fs.existsSync(logPath) && !options.force) {
    console.error(`✗ ${CAPTAINSLOG_FILE} already exists. Use --force to overwrite.`);
    process.exit(1);
  }

  // Get ship name from ∑ship.md if it exists
  const shipPath = path.join(process.cwd(), SHIP_FILE);
  const shipData = readMetadataFile(shipPath);
  const shipname = shipData ? (shipData.data.shipname || path.basename(process.cwd())) : path.basename(process.cwd());

  const data = {
    ship: shipname,
    topics: [],
    entries: []
  };

  const markdown = `# Captain's Log: ${shipname}\n\n`;

  writeMetadataFile(logPath, data, markdown);
  console.log(`✓ Created ${CAPTAINSLOG_FILE}`);
}

function captainslogAdd(title, options) {
  const logPath = path.join(process.cwd(), CAPTAINSLOG_FILE);
  const parsed = readMetadataFile(logPath);

  if (!parsed) {
    console.error(`✗ ${CAPTAINSLOG_FILE} not found. Run 'tagsidecar captainslog init' first.`);
    process.exit(1);
  }

  const date = getCurrentDate();
  const stardate = getCurrentStardate();
  const impact = options.impact || 'low';
  const type = options.type || 'note';
  const content = options.content || '';

  // Add to frontmatter entries
  const entries = ensureArray(parsed.data.entries);
  entries.unshift({
    date,
    stardate,
    type,
    impact,
    title
  });
  parsed.data.entries = entries;

  // Add topics if provided
  if (options.topics) {
    const topicsList = options.topics.split(',').map(t => t.trim());
    const existingTopics = ensureArray(parsed.data.topics);
    parsed.data.topics = [...new Set([...existingTopics, ...topicsList])];
  }

  // Prepend to markdown (newest first)
  const impactLabel = impact.toUpperCase();
  const newEntry = `\n## ${date} - ${title} [${impactLabel} IMPACT]\n\n**Type:** ${type}\n\n${content}\n\n---\n`;
  const newMarkdown = newEntry + parsed.content;

  writeMetadataFile(logPath, parsed.data, newMarkdown);
  console.log(`✓ Added captain's log entry: "${title}"`);
  console.log(`  Impact: ${impact}, Type: ${type}`);
}

// ============================================================================
// TERMINAL COMMANDS
// ============================================================================

function terminalInit(options) {
  const termPath = path.join(process.cwd(), TERMINAL_FILE);

  if (fs.existsSync(termPath) && !options.force) {
    console.error(`✗ ${TERMINAL_FILE} already exists. Use --force to overwrite.`);
    process.exit(1);
  }

  const data = {
    session_name: options.sessionName || 'default',
    last_active: new Date().toISOString(),
    rooms: []
  };

  const markdown = `# Terminal Session: ${data.session_name}\n\n`;

  writeMetadataFile(termPath, data, markdown);
  console.log(`✓ Created ${TERMINAL_FILE}`);
}

function terminalAdd(roomName, options) {
  const termPath = path.join(process.cwd(), TERMINAL_FILE);
  const parsed = readMetadataFile(termPath);

  if (!parsed) {
    console.error(`✗ ${TERMINAL_FILE} not found. Run 'tagsidecar terminal init' first.`);
    process.exit(1);
  }

  const rooms = ensureArray(parsed.data.rooms);
  rooms.push({
    name: roomName,
    description: options.description || '',
    folder: options.folder || '.',
    command: options.command || null,
    autostart: options.autostart !== undefined ? options.autostart : true
  });

  parsed.data.rooms = rooms;
  parsed.data.last_active = new Date().toISOString();

  writeMetadataFile(termPath, parsed.data, parsed.content);
  console.log(`✓ Added room: ${roomName}`);
  console.log(`  Folder: ${options.folder || '.'}`);
  console.log(`  Command: ${options.command || 'none'}`);
}

function terminalList() {
  const termPath = path.join(process.cwd(), TERMINAL_FILE);
  const parsed = readMetadataFile(termPath);

  if (!parsed) {
    console.error(`✗ ${TERMINAL_FILE} not found.`);
    process.exit(1);
  }

  console.log(`\nTerminal Session: ${parsed.data.session_name || 'default'}`);
  console.log(`Rooms: ${(parsed.data.rooms || []).length}\n`);

  (parsed.data.rooms || []).forEach((room, idx) => {
    console.log(`${idx + 1}. ${room.name}`);
    console.log(`   Folder: ${room.folder}`);
    console.log(`   Command: ${room.command || 'none'}`);
    if (room.description) {
      console.log(`   Description: ${room.description}`);
    }
    console.log('');
  });
}

function terminalRestore() {
  const termPath = path.join(process.cwd(), TERMINAL_FILE);
  const parsed = readMetadataFile(termPath);

  if (!parsed) {
    console.error(`✗ ${TERMINAL_FILE} not found.`);
    process.exit(1);
  }

  const rooms = parsed.data.rooms || [];

  if (rooms.length === 0) {
    console.log('No rooms to restore.');
    return;
  }

  console.log(`\nRestoring ${rooms.length} terminal rooms:\n`);

  rooms.forEach((room, idx) => {
    console.log(`${idx + 1}. ${room.name}`);
    console.log(`   cd ${path.resolve(room.folder)}`);
    if (room.command) {
      console.log(`   ${room.command}`);
    }
    console.log('');
  });

  console.log('Note: Automatic terminal opening not yet implemented.');
  console.log('Use the commands above to manually restore your session.');
}

// ============================================================================
// SEARCH COMMANDS
// ============================================================================

function searchAll(query, options) {
  const searchPath = options.path || process.cwd();

  // Build grep pattern for Greek char files
  const greekPattern = GREEK_CHARS.map(char => `${char}*.md`).join('|');

  try {
    let rgCommand = `rg -l "${query}"`;

    // Add file pattern for Greek char files
    GREEK_CHARS.forEach(char => {
      rgCommand += ` -g "${char}*.md"`;
    });

    rgCommand += ` "${searchPath}"`;

    const output = execSync(rgCommand, { encoding: 'utf8' });
    const files = output.trim().split('\n').filter(Boolean);

    if (files.length === 0) {
      console.log(`No results found for: ${query}`);
      return;
    }

    console.log(`\nFound "${query}" in ${files.length} file(s):\n`);

    files.forEach(file => {
      const parsed = readMetadataFile(file);
      if (!parsed) return;

      const relPath = path.relative(searchPath, file);
      console.log(`${relPath}:`);

      // Show relevant data
      if (parsed.data.tags && parsed.data.tags.includes(query)) {
        console.log(`  Tags: ${parsed.data.tags.join(', ')}`);
      }
      if (parsed.data.topics && parsed.data.topics.includes(query)) {
        console.log(`  Topics: ${parsed.data.topics.join(', ')}`);
      }
      if (parsed.data.fleets) {
        const matchingFleet = parsed.data.fleets.find(f => f.name.includes(query));
        if (matchingFleet) {
          console.log(`  Fleet: ${matchingFleet.name} (Rank: ${matchingFleet.rank})`);
        }
      }

      console.log('');
    });

  } catch (error) {
    if (error.status === 1) {
      console.log(`No results found for: ${query}`);
    } else {
      console.error('Error running search:', error.message);
      console.error('Make sure ripgrep (rg) is installed on your system.');
      process.exit(1);
    }
  }
}

// ============================================================================
// DISCOVER COMMAND
// ============================================================================

function discover() {
  const currentDir = process.cwd();

  try {
    // Find all ∑ship.md files in current directory and immediate subdirectories
    const findCommand = `find . -maxdepth 2 -name "${SHIP_FILE}" -type f`;
    const output = execSync(findCommand, { encoding: 'utf8' });
    const shipFiles = output.trim().split('\n').filter(Boolean);

    if (shipFiles.length === 0) {
      console.log('No ships found in this directory or subdirectories.');
      return;
    }

    console.log(`\nFound ${shipFiles.length} ship(s):\n`);

    shipFiles.forEach(shipFile => {
      const parsed = readMetadataFile(shipFile);
      if (!parsed) return;

      const dir = path.dirname(shipFile);
      const relDir = dir === '.' ? '(current)' : dir;

      // Get star from fleet
      let star = '';
      if (parsed.data.fleets && parsed.data.fleets.length > 0) {
        const highestRankedFleet = parsed.data.fleets.reduce((prev, current) =>
          (current.rank || 0) > (prev.rank || 0) ? current : prev
        );
        star = highestRankedFleet.star || '';
      }

      console.log(`${relDir} ${star}`);
      console.log(`  Name: ${parsed.data.shipname || 'Unnamed'}`);
      console.log(`  Status: ${parsed.data.status || 'unknown'}`);

      if (parsed.data.tags && parsed.data.tags.length > 0) {
        console.log(`  Tags: ${parsed.data.tags.join(', ')}`);
      }

      if (parsed.data.fleets && parsed.data.fleets.length > 0) {
        console.log(`  Fleets:`);
        parsed.data.fleets.forEach(fleet => {
          console.log(`    - ${fleet.name} (Rank: ${fleet.rank || 0})`);
        });
      }

      console.log('');
    });

  } catch (error) {
    console.error('Error discovering ships:', error.message);
  }
}

// ============================================================================
// EXPORTS (for programmatic use)
// ============================================================================

module.exports = {
  shipInit,
  shipAddTag,
  shipRemoveTag,
  shipFleetAdd,
  shipShow,
  captainslogInit,
  captainslogAdd,
  terminalInit,
  terminalAdd,
  terminalList,
  terminalRestore,
  searchAll,
  discover
};

// ============================================================================
// CLI COMMANDS (only run when executed directly)
// ============================================================================

if (require.main === module) {
  program
    .name('tagsidecar')
    .description('Sidecar metadata file management for developers who work in frenzies')
    .version('1.0.0');

  // SHIP COMMANDS
  const ship = program.command('ship').description('Ship metadata operations');

  ship
    .command('init')
    .description('Create ∑ship.md in current directory')
    .option('-f, --force', 'Overwrite existing file')
    .option('--shipname <name>', 'Ship name')
    .option('--purpose <purpose>', 'Ship purpose')
    .action(shipInit);

  ship
    .command('add-tag <tags...>')
    .description('Add tags to ship')
    .action(shipAddTag);

  ship
    .command('remove-tag <tags...>')
    .description('Remove tags from ship')
    .action(shipRemoveTag);

  ship
    .command('fleet-add <fleet>')
    .description('Add ship to fleet')
    .option('--rank <rank>', 'Fleet rank (0 to ∞)')
    .option('--star <emoji>', 'Star emoji')
    .option('--role <role>', 'Role in fleet')
    .action(shipFleetAdd);

  ship
    .command('show')
    .description('Show ship metadata')
    .action(shipShow);

  // CAPTAINSLOG COMMANDS
  const captainslog = program.command('captainslog').description('Captain\'s log operations');

  captainslog
    .command('init')
    .description('Create ∆captainslog.md in current directory')
    .option('-f, --force', 'Overwrite existing file')
    .action(captainslogInit);

  captainslog
    .command('add <title>')
    .description('Add entry to captain\'s log')
    .option('--impact <level>', 'Impact level (high, medium, low)')
    .option('--type <type>', 'Entry type (breakthrough, discovery, note)')
    .option('--content <text>', 'Entry content')
    .option('--topics <topics>', 'Comma-separated topics')
    .action(captainslogAdd);

  // TERMINAL COMMANDS
  const terminal = program.command('terminal').description('Terminal session operations');

  terminal
    .command('init')
    .description('Create ∫terminal.md in current directory')
    .option('-f, --force', 'Overwrite existing file')
    .option('--session-name <name>', 'Session name')
    .action(terminalInit);

  terminal
    .command('add <name>')
    .description('Add room to terminal session')
    .option('--folder <path>', 'Folder path (relative)')
    .option('--command <cmd>', 'Command to run')
    .option('--description <desc>', 'Room description')
    .option('--autostart <bool>', 'Auto-start command', true)
    .action(terminalAdd);

  terminal
    .command('list')
    .description('List terminal rooms')
    .action(terminalList);

  terminal
    .command('restore')
    .description('Restore terminal session')
    .action(terminalRestore);

  // CONVENIENCE COMMANDS (shortcuts)
  program
    .command('add <tags...>')
    .description('Add tags to ship (shortcut for ship add-tag)')
    .action(shipAddTag);

  program
    .command('remove <tags...>')
    .description('Remove tags from ship (shortcut for ship remove-tag)')
    .action(shipRemoveTag);

  // Note: 'fleet add' conflicts with 'add' command
  // Use: tagsidecar ship fleet-add <fleet> or tagsidecar fleet <fleet>

  program
    .command('fleet <fleet>')
    .description('Add ship to fleet (shortcut for ship fleet-add)')
    .option('--rank <rank>', 'Fleet rank')
    .option('--star <emoji>', 'Star emoji')
    .option('--role <role>', 'Role in fleet')
    .action(shipFleetAdd);

  // SEARCH COMMAND
  program
    .command('search <query>')
    .description('Search across all Greek char .md files')
    .option('-p, --path <path>', 'Search path (default: current directory)')
    .action(searchAll);

  // DISCOVER COMMAND
  program
    .command('discover')
    .description('Discover ships in current directory and subdirectories')
    .action(discover);

  program.parse(process.argv);
}
