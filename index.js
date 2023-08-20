const {spawn} = require('child_process');
require("colors")

console.log(`[TS]`.cyan + ` Transpiling...`.yellow)

const spawned = spawn(`npm run dev`, {
    cwd: `${process.cwd()}`,
    shell: true,
    stdio: 'inherit'
});