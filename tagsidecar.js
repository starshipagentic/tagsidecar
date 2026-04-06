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

// Directories to skip when scanning ~ (--scope all)
const SKIP_DIRS = [
  'Library', '.Trash', 'node_modules', '.git', 'venv', '.venv',
  '__pycache__', '.cache', '.npm', '.nvm', '.pyenv', '.cargo',
  'Applications', 'Music', 'Movies', 'Pictures', 'Photos',
  '.local/share', '.docker', 'go/pkg', 'OrbStack',
];

/**
 * Score a repo entry for dedup. Higher = preferred copy.
 * Factors: recency (days since last entry) and path depth (shallower = more local).
 */
function _dedupScore(repo, searchPath) {
  let score = 0;

  // Recency: days since last entry (max 365 points, newer = higher)
  const lastDate = repo.last_date || '1970-01-01';
  const daysAgo = (Date.now() - new Date(lastDate).getTime()) / 86400000;
  score += Math.max(0, 365 - daysAgo);

  // Path depth: fewer slashes from searchPath = closer to user's working dirs
  // A file at ~/dev/project/ scores higher than ~/deep/cache/acct/project/
  const loc = repo.location || repo.repo || '';
  const relPath = path.relative(searchPath, loc);
  const depth = relPath.split(path.sep).length;
  score += Math.max(0, 20 - depth) * 5;  // up to 100 points for shallow paths

  return score;
}

/**
 * Resolve --scope to a search path.
 *   "here"  = just cwd (no recursion — handled by caller)
 *   "tree"  = cwd, recurse into subdirs (default)
 *   "all"   = home dir, recurse with exclusions
 * --path overrides --scope entirely.
 */
function resolveSearchPath(options) {
  if (options.path) return { searchPath: options.path, scope: 'tree' };
  const scope = (options.scope || 'tree').toLowerCase();
  switch (scope) {
    case 'here': return { searchPath: process.cwd(), scope: 'here' };
    case 'all':  return { searchPath: os.homedir(), scope: 'all' };
    case 'tree':
    default:     return { searchPath: process.cwd(), scope: 'tree' };
  }
}

/**
 * Find all files matching a filename under searchPath using rg --files.
 * Respects scope for exclusions and depth.
 */
function findFiles(filename, searchPath, scope) {
  const { spawnSync } = require('child_process');
  const args = ['--files', '-g', filename];

  if (scope === 'here') {
    args.push('--max-depth', '1');
  }

  if (scope === 'all') {
    // Include hidden dirs like .starforge/harvest-cache
    args.push('--hidden');
    for (const dir of SKIP_DIRS) {
      args.push('-g', `!${dir}`);
    }
  }

  args.push(searchPath);

  const result = spawnSync('rg', args, { encoding: 'utf8', timeout: 10000 });
  if (result.stdout) {
    return result.stdout.trim().split('\n').filter(Boolean);
  }
  return [];
}

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
// NOTE COMMAND (shared by all file types)
// ============================================================================

function addNote(filePath, text, options) {
  const parsed = readMetadataFile(filePath);

  if (!parsed) {
    console.error(`✗ File not found: ${path.basename(filePath)}`);
    process.exit(1);
  }

  const timestamp = options.skipTimestamp ? '' : `## ${getCurrentDate()}\n\n`;
  const newMarkdown = parsed.content + timestamp + text + '\n\n';

  writeMetadataFile(filePath, parsed.data, newMarkdown);
  console.log(`✓ Added note to ${path.basename(filePath)}`);
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

  const markdown = `# ${data.shipname}\n\nMarkdown area below\n\n`;

  writeMetadataFile(shipPath, data, markdown);
  console.log(`✓ Created ${SHIP_FILE}`);
}

function shipNote(text, options) {
  addNote(path.join(process.cwd(), SHIP_FILE), text, options);
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

function captainslogNote(text, options) {
  addNote(path.join(process.cwd(), CAPTAINSLOG_FILE), text, options);
}


function captainslogActive(options) {
  const { searchPath, scope } = resolveSearchPath(options);
  const days = parseInt(options.days || '30', 10);
  const jsonOutput = options.json || false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const files = findFiles(CAPTAINSLOG_FILE, searchPath, scope);

    const active = [];

    const tagFilter = options.tag ? options.tag.toLowerCase().split(',').map(t => t.trim()) : null;

    files.forEach(file => {
      const parsed = readMetadataFile(file);
      if (!parsed || !parsed.data.entries) return;

      // Read ∑ship.md in the same directory for tags
      const dir = path.dirname(file);
      const shipFile = path.join(dir, SHIP_FILE);
      const shipData = readMetadataFile(shipFile);
      const tags = shipData ? ensureArray(shipData.data.tags) : [];

      // Filter by tag if requested
      if (tagFilter) {
        const tagsLower = tags.map(t => t.toLowerCase());
        const hasTag = tagFilter.some(t => tagsLower.includes(t));
        if (!hasTag) return;
      }

      const entries = ensureArray(parsed.data.entries);
      const recent = entries.filter(e => e.date && e.date >= cutoffStr);

      if (recent.length > 0) {
        const relPath = path.relative(searchPath, path.dirname(file));
        const detail = parseInt(options.detail || '1', 10);
        const showLocations = options.locations || false;
        const topEntries = recent.slice(0, detail).map(e => ({
          date: e.date,
          type: e.type || '',
          impact: e.impact || '',
          title: e.title || '',
        }));
        active.push({
          repo: relPath || path.basename(path.dirname(file)),
          ship: parsed.data.ship || path.basename(path.dirname(file)),
          location: showLocations ? file : undefined,
          tags: tags.length > 0 ? tags : undefined,
          entries_recent: recent.length,
          entries_total: entries.length,
          last_date: recent[0].date,
          last_title: recent[0].title || '',
          last_impact: recent[0].impact || '',
          last_type: recent[0].type || '',
          topics: ensureArray(parsed.data.topics).slice(0, 10),
          entries: detail > 1 ? topEntries : undefined,
        });
      }
    });

    active.sort((a, b) => (b.last_date || '').localeCompare(a.last_date || ''));

    // Deduplicate by ship name.
    // Score each copy: newer is better, shallower path depth is better (local
    // working copies live closer to ~ than deep cache hierarchies).
    // --raw skips this and returns everything for smart callers.
    if (!options.raw) {
      const merged = new Map();
      for (const r of active) {
        const key = r.ship;
        const score = _dedupScore(r, searchPath);

        if (!merged.has(key)) {
          r._score = score;
          merged.set(key, r);
        } else {
          const existing = merged.get(key);
          if (score > existing._score) {
            r.entries_recent = Math.max(r.entries_recent, existing.entries_recent);
            r.entries_total = Math.max(r.entries_total, existing.entries_total);
            r._score = score;
            merged.set(key, r);
          } else {
            existing.entries_recent = Math.max(r.entries_recent, existing.entries_recent);
            existing.entries_total = Math.max(r.entries_total, existing.entries_total);
          }
        }
      }
      active.length = 0;
      for (const r of merged.values()) {
        delete r._score;
        active.push(r);
      }
      active.sort((a, b) => (b.last_date || '').localeCompare(a.last_date || ''));
    }

    if (jsonOutput) {
      console.log(JSON.stringify({ days, active_repos: active.length, repos: active }, null, 2));
      return;
    }

    if (active.length === 0) {
      console.log(`No captain's log activity in the last ${days} days.`);
      return;
    }

    console.log(`\nActive projects (last ${days} days): ${active.length}\n`);
    active.forEach(r => {
      const marker = r.last_impact === 'high' ? '★' : ' ';
      console.log(`${marker} ${r.ship}`);
      if (r.location) {
        console.log(`  Path: ${r.location}`);
      }
      if (r.tags && r.tags.length > 0) {
        console.log(`  Tags: ${r.tags.join(', ')}`);
      }
      console.log(`  Last: ${r.last_date} — ${r.last_title}`);
      console.log(`  Entries: ${r.entries_recent} recent / ${r.entries_total} total`);
      if (r.topics.length > 0) {
        console.log(`  Topics: ${r.topics.join(', ')}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error scanning logs:', error.message);
    process.exit(1);
  }
}


function captainslogContext(options) {
  const jsonOutput = options.json || false;
  const logPath = path.join(process.cwd(), CAPTAINSLOG_FILE);
  const parsed = readMetadataFile(logPath);

  if (!parsed) {
    console.error(`No captain's log in ${process.cwd()}`);
    console.error(`Run: tagsidecar captainslog init`);
    process.exit(1);
  }

  const entries = ensureArray(parsed.data.entries);
  const recent = entries.slice(0, 5);
  const topics = ensureArray(parsed.data.topics).slice(0, 20);

  const result = {
    project: parsed.data.ship || path.basename(process.cwd()),
    directory: process.cwd(),
    topics,
    total_entries: entries.length,
    recent_entries: recent,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n${result.project}`);
  console.log(`${result.directory}\n`);
  if (topics.length > 0) {
    console.log(`Topics: ${topics.join(', ')}\n`);
  }
  console.log(`Entries: ${result.total_entries} total\n`);
  recent.forEach(e => {
    const marker = e.impact === 'high' ? '★' : ' ';
    console.log(`${marker} ${e.date || ''} ${e.title || ''}`);
  });
  console.log('');
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

function terminalNote(text, options) {
  addNote(path.join(process.cwd(), TERMINAL_FILE), text, options);
}

// ============================================================================
// SEARCH COMMANDS
// ============================================================================

function searchAll(query, options) {
  const { searchPath, scope } = resolveSearchPath(options);
  const jsonOutput = options.json || false;
  const showLocations = options.locations || false;
  const queryLower = query.toLowerCase();

  try {
    const { spawnSync } = require('child_process');
    const args = ['-l', query, '-i'];
    GREEK_CHARS.forEach(char => {
      args.push('-g', `${char}*.md`);
    });
    if (scope === 'here') {
      args.push('--max-depth', '1');
    }
    if (scope === 'all') {
      args.push('--hidden');
      for (const dir of SKIP_DIRS) {
        args.push('-g', `!${dir}`);
      }
    }
    args.push(searchPath);

    const result = spawnSync('rg', args, { encoding: 'utf8', timeout: 10000 });
    const files = (result.stdout || '').trim().split('\n').filter(Boolean);

    if (files.length === 0) {
      if (jsonOutput) {
        console.log(JSON.stringify({ query, results: [] }));
      } else {
        console.log(`No results found for: ${query}`);
      }
      return;
    }

    const results = [];

    files.forEach(file => {
      const parsed = readMetadataFile(file);
      if (!parsed) return;

      const relPath = path.relative(searchPath, file);
      const basename = path.basename(file);
      const dir = path.dirname(file);

      const entry = {
        file: relPath,
        location: showLocations ? file : undefined,
      };

      // For captain's logs: extract matching entries with dates
      if (basename === CAPTAINSLOG_FILE && parsed.data.entries) {
        const ship = parsed.data.ship || path.basename(dir);
        const allEntries = ensureArray(parsed.data.entries);
        const matching = allEntries.filter(e => {
          const text = [e.title || '', e.type || '', e.content || ''].join(' ').toLowerCase();
          return text.includes(queryLower);
        });
        // If no entries match by content, the query matched in the markdown body
        // Still return the most recent entries as context
        const relevant = matching.length > 0 ? matching : allEntries.slice(0, 3);
        entry.ship = ship;
        entry.type = 'captainslog';
        entry.matching_entries = relevant.slice(0, 10).map(e => ({
          date: e.date || '',
          type: e.type || '',
          impact: e.impact || '',
          title: e.title || '',
        }));
        entry.total_matches = matching.length;
      } else {
        // For other Greek files: return tags, topics, fleets
        entry.type = basename.replace('.md', '');
        if (parsed.data.tags) entry.tags = ensureArray(parsed.data.tags);
        if (parsed.data.topics) entry.topics = ensureArray(parsed.data.topics);
        if (parsed.data.shipname) entry.ship = parsed.data.shipname;
      }

      results.push(entry);
    });

    // Sort: captain's logs first (most useful), then by date
    results.sort((a, b) => {
      if (a.type === 'captainslog' && b.type !== 'captainslog') return -1;
      if (b.type === 'captainslog' && a.type !== 'captainslog') return 1;
      const aDate = (a.matching_entries || [])[0]?.date || '';
      const bDate = (b.matching_entries || [])[0]?.date || '';
      return bDate.localeCompare(aDate);
    });

    if (jsonOutput) {
      console.log(JSON.stringify({ query, results }, null, 2));
      return;
    }

    console.log(`\nFound "${query}" in ${results.length} file(s):\n`);
    results.forEach(r => {
      console.log(`${r.file}:`);
      if (r.location) console.log(`  Path: ${r.location}`);
      if (r.ship) console.log(`  Ship: ${r.ship}`);
      if (r.matching_entries) {
        r.matching_entries.forEach(e => {
          const marker = e.impact === 'high' ? '★' : ' ';
          console.log(`  ${marker} ${e.date} [${e.type}] ${e.title}`);
        });
      }
      if (r.tags) console.log(`  Tags: ${r.tags.join(', ')}`);
      if (r.topics) console.log(`  Topics: ${r.topics.join(', ')}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error running search:', error.message);
    process.exit(1);
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
  shipNote,
  captainslogInit,
  captainslogAdd,
  captainslogNote,
  captainslogActive,
  captainslogContext,
  terminalInit,
  terminalAdd,
  terminalList,
  terminalRestore,
  terminalNote,
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
    .version('1.2.0');

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

  ship
    .command('note <text>')
    .description('Append note to ship markdown')
    .option('--skip-timestamp', 'Skip automatic timestamp heading')
    .action(shipNote);

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

  captainslog
    .command('note <text>')
    .description('Append note to captain\'s log markdown')
    .option('--skip-timestamp', 'Skip automatic timestamp heading')
    .action(captainslogNote);

  captainslog
    .command('active')
    .description('Show repos with recent captain\'s log activity')
    .option('-s, --scope <scope>', 'Search scope: here (cwd only), tree (cwd recursive, default), all (home dir)')
    .option('-p, --path <path>', 'Explicit search path (overrides --scope)')
    .option('-d, --days <days>', 'Look back this many days (default: 30)')
    .option('--tag <tags>', 'Filter to repos with this tag (comma-separated)')
    .option('--detail <n>', 'Show last N entries per repo (default: 1)')
    .option('--locations', 'Include file paths in output')
    .option('--raw', 'Skip dedup — return all copies (for callers that do their own merging)')
    .option('--json', 'Output as JSON for programmatic use')
    .action(captainslogActive);

  captainslog
    .command('context')
    .description('What\'s going on in this project — ship, topics, recent entries')
    .option('--json', 'Output as JSON for programmatic use')
    .action(captainslogContext);

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

  terminal
    .command('note <text>')
    .description('Append note to terminal markdown')
    .option('--skip-timestamp', 'Skip automatic timestamp heading')
    .action(terminalNote);

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
    .description('Search across all Greek char .md files — returns matching entries with dates')
    .option('-s, --scope <scope>', 'Search scope: here (cwd only), tree (cwd recursive, default), all (home dir)')
    .option('-p, --path <path>', 'Explicit search path (overrides --scope)')
    .option('--locations', 'Include file paths in output')
    .option('--json', 'Output as JSON for programmatic use')
    .action(searchAll);

  // DISCOVER COMMAND
  program
    .command('discover')
    .description('Discover ships in current directory and subdirectories')
    .action(discover);

  program.parse(process.argv);
}
