// Sets a new password for an existing admin account, e.g. on the deployed (Neon) database.
//
// Run from backend/ in an interactive terminal:  npm run set-admin-password
//
// The password is only ever typed at a hidden prompt: it is never accepted as a command-line argument
// (those end up in shell history and process lists) and it is never printed or logged.

const readline = require('node:readline/promises');
const { pool, query } = require('../src/db/pool');
const { hashPassword } = require('../src/modules/auth/auth.service');

const MIN_LENGTH = 12;
const MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes
const MIN_DISTINCT_CHARACTERS = 6;
// Passwords that contain one of these are among the first an attacker tries.
const COMMON_PARTS = ['password', 'passw0rd', 'admin', 'qwerty', 'letmein', 'welcome', '123456', 'swms', 'abc123'];

// Returns a list of problems (empty = strong enough). Messages never include the password itself.
function checkAdminPassword(password, email = '') {
  const problems = [];
  const lower = password.toLowerCase();
  const emailName = email.split('@')[0].toLowerCase();

  if (password.length < MIN_LENGTH) {
    problems.push(`Password must be at least ${MIN_LENGTH} characters`);
  }
  if (password.length > MAX_LENGTH) {
    problems.push(`Password must be at most ${MAX_LENGTH} characters`);
  }
  if (new Set(password).size < MIN_DISTINCT_CHARACTERS) {
    problems.push(`Password must use at least ${MIN_DISTINCT_CHARACTERS} different characters`);
  }
  if (COMMON_PARTS.some((part) => lower.includes(part))) {
    problems.push('Password must not contain common words such as "password" or "admin"');
  }
  if (emailName.length >= 3 && lower.includes(emailName)) {
    problems.push('Password must not contain the email address');
  }
  return problems;
}

// Hashes the password exactly like registration and stores it. Only admin accounts can be changed here.
async function setAdminPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const { rows } = await query('SELECT id, role FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
  const user = rows[0];

  if (!user) {
    throw new Error('No account with that email');
  }
  if (user.role !== 'admin') {
    throw new Error('That account is not an admin');
  }

  const passwordHash = await hashPassword(password);
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, passwordHash]);
  return { id: user.id, email: normalizedEmail };
}

// Reads one line without echoing it (raw mode). Enter finishes, Backspace deletes, Ctrl+C cancels.
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    let value = '';

    function finish(callback) {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      callback();
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\r' || character === '\n') {
          return finish(() => resolve(value));
        }
        if (character === '\u0003') {
          return finish(() => reject(new Error('Cancelled')));
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.resume();
  });
}

async function promptVisible(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Run this in an interactive terminal (PowerShell or Windows Terminal; in Git Bash prefix it with `winpty`). ' +
        'The password can only be typed at a hidden prompt.'
    );
  }

  const email = await promptVisible('Admin email: ');
  const password = await promptHidden('New password (hidden): ');
  const repeated = await promptHidden('Repeat the new password: ');

  if (password !== repeated) {
    throw new Error('The two passwords do not match. Nothing was changed.');
  }
  const problems = checkAdminPassword(password, email);
  if (problems.length > 0) {
    throw new Error(`Password is not strong enough. Nothing was changed.\n  ${problems.join('\n  ')}`);
  }

  const { email: updatedEmail } = await setAdminPassword(email, password);
  console.log(`Password updated for ${updatedEmail}.`);
  console.log('Tokens issued before this change stay valid until they expire (JWT_EXPIRES_IN).');
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { checkAdminPassword, setAdminPassword };
