const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.tsx', 'utf8');

// Add import
if (!code.includes("import LoginView")) {
  code = code.replace("import { Activity", "import LoginView from './components/LoginView';\nimport { Activity");
}

// Replace login block
const loginBlock = `
  if (!user) {
    return <LoginView />;
  }
`;

code = code.replace(/if \(\!user\) \{[\s\S]*?return \([\s\S]*?<div className="min-h-screen bg-black[\s\S]*?<\/div>\n    \);\n  \}/, loginBlock.trim());

fs.writeFileSync('frontend/src/App.tsx', code);
