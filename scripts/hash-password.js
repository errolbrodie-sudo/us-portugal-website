/* Prints an Argon2id hash for ADMIN_PASSWORD_HASH. The password is read from the
   terminal (hidden) so it never appears in shell history.
   Usage: npm run hash-password */
import { createInterface } from 'node:readline';
import { hashPassword } from '../lib/auth.js';

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = text => { if (!rl.muted) rl.output.write(text); };
rl.question('Administrator password: ', async password => {
  rl.close();
  process.stdout.write('\n');
  if (!password) {
    console.error('No password entered.');
    process.exit(1);
  }
  console.log(await hashPassword(password));
});
rl.muted = true;
