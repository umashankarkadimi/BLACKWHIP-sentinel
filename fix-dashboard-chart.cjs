const fs = require('fs');

let code = fs.readFileSync('frontend/src/components/Dashboard.tsx', 'utf8');

// We want to replace the chartData useMemo with a state that accumulates eps.
// First, add useEffect to the imports if not there.
if (!code.includes('useEffect')) {
    code = code.replace(/import React, {([^}]+)} from 'react';/, "import React, { $1, useEffect } from 'react';");
}

code = code.replace(/const chartData = useMemo[\s\S]*?\}, \[state\.eps\]\);/, `
  const [chartData, setChartData] = useState<{time: string, events: number}[]>([]);

  useEffect(() => {
    setChartData(prev => {
      const now = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
      const newData = [...prev, { time: now, events: state.eps }];
      if (newData.length > 20) newData.shift();
      return newData;
    });
  }, [state.eps]);
`);

fs.writeFileSync('frontend/src/components/Dashboard.tsx', code);
