const fs = require('fs');
const babel = require('@babel/core');
const code = fs.readFileSync('src/components/MeetingPage.js', 'utf-8');
try {
  babel.transform(code, {
    presets: ['@babel/preset-react']
  });
  console.log("No syntax errors found!");
} catch (e) {
  console.error(e.message);
}
