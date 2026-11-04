// Very common passwords (8+ characters; shorter ones are already rejected), taken from public
// "most used passwords" lists, plus a few common in Indonesia. Attackers try these first.
// Compared in lowercase, so "PASSWORD1" is blocked too. Only used for new passwords (registration),
// never for login, so existing accounts can always sign in.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '0123456789', '12341234', '12344321', '87654321', '11111111',
  '00000000', '88888888', '99999999', '12121212', '11223344', '123123123', '147258369', '123456123',
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'pass1234', 'qwertyui', 'qwertyuiop', 'qwerty12', 'qwerty123', 'qwerty1234', 'qwer1234', '1q2w3e4r',
  '1q2w3e4r5t', '1qaz2wsx', 'q1w2e3r4', 'q1w2e3r4t5', 'zaq12wsx', '123qweasd', 'asdfghjk', 'asdfasdf',
  'asdf1234', 'zxcvbnm1', 'zxcvbnmm', 'abcd1234', 'abc12345', 'abcdefgh', 'aa123456', 'a1234567',
  'iloveyou', 'iloveyou1', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'starwars',
  'whatever', 'computer', 'internet', 'trustno1', 'letmein1', 'welcome1', 'welcome123', 'michael1',
  'jennifer', 'charlie1', 'shadow12', 'monkey123', 'dragon123', 'master123', 'freedom1', 'liverpool',
  'chelsea1', 'admin123', 'admin1234', 'administrator', 'changeme', 'changeme1', 'default1', 'secret123',
  'bismillah', 'indonesia', 'jakarta123', 'sayang123', 'rahasia123', 'swms1234', 'wastewaste',
]);

function isCommonPassword(password) {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

module.exports = { isCommonPassword };
