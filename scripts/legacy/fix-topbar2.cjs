const fs = require('fs');

let code = fs.readFileSync('frontend/src/components/TopBar.tsx', 'utf8');

// The lines were:
//             AUTONOMOUS DEFENSE {state.autonomousDefense ? 'ON' : 'OFF'}
//           </button>
//           
//           
//           </div>
//         </div>
code = code.replace(/<\/button>\s*<\/div>\s*<\/div>/, '</button>\n        </div>');

fs.writeFileSync('frontend/src/components/TopBar.tsx', code);
