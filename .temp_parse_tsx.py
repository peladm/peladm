from pathlib import Path
import json

p = Path('src/app/modo-torneio/painel/page.tsx')
src = p.read_text(encoding='utf-8')
print(f'Loaded {p} ({len(src)} chars)')
try:
    import subprocess, sys, os
    node = 'node'
    res = subprocess.run([node, '-e', (
        'const fs = require("fs");'
        'const ts = require("typescript");'
        'const src = fs.readFileSync(process.argv[1], "utf8");'
        'const res = ts.createSourceFile(process.argv[2], src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);'
        'res.parseDiagnostics.forEach(d => {'
        '  const start = d.start != null ? d.start : -1;'
        '  const line = start >= 0 ? src.slice(0, start).split(/\\r?\\n/).length : -1;'
        '  const col = start >= 0 ? start - src.slice(0, start).lastIndexOf("\\n") - 1 : -1;'
        '  console.log(`${line}:${col}:${d.code}:${d.messageText}`);'
        '});'
    ), str(p), p.name], capture_output=True, text=True)
    print('node exit', res.returncode)
    print('stdout:')
    print(res.stdout)
    print('stderr:')
    print(res.stderr)
except Exception as e:
    print('error', e)
