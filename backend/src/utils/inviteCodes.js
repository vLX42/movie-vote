const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // Omit confusable chars (0,O,1,l,i)

function generateInviteCode(length = 10) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

module.exports = { generateInviteCode };
