const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.tsx', 'utf8');

const loginBlock = `
  if (!user) {
    return <LoginView />;
  }
`;

code = code.replace(/if \(\!user\) \{[\s\S]*?Authenticate via Single Sign-On[\s\S]*?<\/button>\n        <\/div>\n      <\/div>\n    \);\n  \}/, loginBlock.trim());

fs.writeFileSync('frontend/src/App.tsx', code);
