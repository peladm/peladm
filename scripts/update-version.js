#!/usr/bin/env node

/**
 * Script para atualizar versão do app
 * Uso: node update-version.js <nova-versao> "<titulo>" "<descricao-features>"
 * Exemplo: node update-version.js 2.2.0 "Melhorias Gerais" "Nova tela de estatísticas"
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('❌ Uso: node update-version.js <versao> [titulo] [features...]');
  console.error('   Exemplo: node update-version.js 2.2.0 "Melhorias" "Feature 1" "Feature 2"');
  process.exit(1);
}

const newVersion = args[0];
const title = args[1] || 'Atualização';
const features = args.slice(2);

console.log(`🔄 Atualizando versão para ${newVersion}...`);

// Atualiza version.json
const versionPath = path.join(__dirname, '..', 'public', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

const today = new Date();
const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
const isoDate = today.toISOString().split('T')[0];

versionData.version = newVersion;
versionData.releaseDate = isoDate;
versionData.changelog[newVersion] = {
  date: dateStr,
  title: title,
  features: features.length > 0 ? features : ['Melhorias gerais e correções de bugs']
};

fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));
console.log('✅ version.json atualizado');

// Atualiza manifest.json
const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifestData.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
console.log('✅ manifest.json atualizado');

// Atualiza sw.js
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(
  /const APP_VERSION = '[^']+'/,
  `const APP_VERSION = '${newVersion}'`
);
fs.writeFileSync(swPath, swContent);
console.log('✅ sw.js atualizado');

console.log(`\n🎉 Versão ${newVersion} configurada com sucesso!`);
console.log('\n📋 Próximos passos:');
console.log('   1. git add .');
console.log(`   2. git commit -m "chore: bump version to ${newVersion}"`);
console.log('   3. git push');
console.log('\n💡 Os usuários verão automaticamente a notificação de atualização!\n');
