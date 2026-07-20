#!/bin/bash
set -e
if [ ! -f "prisma/seed.ts" ]; then
  echo "ERROR: prisma/seed.ts not found. Run this from the flowcast repo root."
  echo "Current directory: $(pwd)"
  exit 1
fi
echo "Repo root confirmed: $(pwd)"
git rm --cached src/generated/prisma/index.ts 2>/dev/null || echo "(index.ts wasn't tracked - fine, continuing)"
rm -rf src/generated
grep -v "generated/prisma" .gitignore > /tmp/gitignore_clean || true
mv /tmp/gitignore_clean .gitignore
echo "/src/generated/prisma/*" >> .gitignore
FILES=$(grep -rl '"@/generated/prisma"' src prisma 2>/dev/null || true)
if [ -n "$FILES" ]; then
  for f in $FILES; do
    sed -i.bak 's#"@/generated/prisma"#"@/generated/prisma/client"#g' "$f"
    rm -f "$f.bak"
  done
  echo "Patched: $FILES"
else
  echo "(no files matched @/generated/prisma - may already be patched)"
fi
if grep -q '"../src/generated/prisma"' prisma/seed.ts; then
  sed -i.bak 's#"../src/generated/prisma"#"../src/generated/prisma/client"#' prisma/seed.ts
  rm -f prisma/seed.ts.bak
  echo "Patched: prisma/seed.ts"
else
  echo "(prisma/seed.ts already patched or pattern not found)"
fi
echo ""
echo "Done. Now run:"
echo "  npx prisma generate"
echo "  npx prisma migrate dev --name init"
echo "  npm run db:seed"
