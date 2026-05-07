const fs = require('fs');
const c = fs.readFileSync('C:/Users/andre/Documents/Deepseek/Code App/public/chat.html', 'utf-8');
const matches = [...c.matchAll(/<script>([\s\S]*?)<\/script>/g)];
matches.forEach((m, i) => {
  try {
    new Function(m[1]);
  } catch(e) {
    const lines = m[1].split('\n').length;
    console.log(`Script block ${i + 1} (${lines} lines): SYNTAX ERROR - ${e.message}`);
    // Find the error location
    const lines2 = m[1].split('\n');
    for (let l = 0; l < lines2.length; l++) {
      try { new Function(lines2.slice(0, l+1).join('\n')); } catch(e2) { continue; }
    }
    console.log(`  Error near line ${lines2.length} (last few lines):`);
    lines2.slice(-5).forEach((line, idx) => console.log(`  ${lines2.length - 5 + idx + 1}: ${line}`));
  }
});
