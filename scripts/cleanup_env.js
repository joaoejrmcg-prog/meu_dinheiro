const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('.env.local not found');
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split('\n');

const newLines = lines.map(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return line;
  }

  // Keep Supabase keys
  if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL') || trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
    return line;
  }

  // Keep OpenAI Key (Critical for AI)
  if (trimmed.startsWith('OPENAI_API_KEY')) {
    return line;
  }

  // Comment out everything else
  return `# ${line}`;
});

fs.writeFileSync(envPath, newLines.join('\n'));
console.log('Updated .env.local. Kept Supabase and OpenAI keys. Commented out others.');
