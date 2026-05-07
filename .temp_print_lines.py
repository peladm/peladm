from pathlib import Path
import sys
p=Path('src/app/modo-torneio/painel/page.tsx')
text=p.read_text(encoding='utf-8').splitlines()
start=1788
end=1905
for i in range(start-1, min(end, len(text))):
    print(f'{i+1}: {text[i]}')
print('--- total lines', len(text))
