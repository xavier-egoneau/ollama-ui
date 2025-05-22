// agents/code.js
import { spawn } from 'child_process';

export async function execute({ prompt }) {
  return new Promise((resolve) => {
    const bannedModules = ['os', 'subprocess', 'sys', 'shutil', 'socket', 'open', 'eval', 'exec'];
    const forbidden = bannedModules.find(word => prompt.includes(word));
    if (forbidden) {
      return resolve(`❌ Code interdit : usage de \`${forbidden}\``);
    }

    let result = '';
    const proc = spawn('python', ['-c', prompt]);

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      return resolve('⏱️ Exécution stoppée : trop longue (timeout)');
    }, 3000); // ⏱️ 3 secondes max

    proc.stdout.on('data', (data) => {
      result += data.toString();
    });

    proc.stderr.on('data', (data) => {
      result += `❌ Erreur : ${data.toString()}`;
    });

    proc.on('close', () => {
      clearTimeout(timeout);
      resolve(`\`\`\`python\n${result.trim()}\n\`\`\``);
    });
  });
}
