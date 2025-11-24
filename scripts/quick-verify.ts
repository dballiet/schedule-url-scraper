import { ASSOCIATIONS } from '../src/lib/associations';

console.log('Quick verification of association counts and URLs:\n');

const total = ASSOCIATIONS.length;
const rochester = ASSOCIATIONS.find(a => a.name.includes('Rochester'));
const northBranch = ASSOCIATIONS.find(a => a.name.includes('North Branch'));
const mendota = ASSOCIATIONS.find(a => a.name.includes('Mendota'));
const richfield = ASSOCIATIONS.find(a => a.name.includes('Richfield'));

console.log(`Total associations: ${total}`);
console.log(`\n✅ Rochester: ${rochester ? rochester.baseUrl : 'NOT FOUND'}`);
console.log(`✅ North Branch: ${northBranch ? northBranch.baseUrl : 'NOT FOUND'}`);
console.log(`\n❌ Mendota Heights removed: ${mendota ? 'STILL PRESENT!' : 'Successfully removed'}`);
console.log(`❌ Richfield removed: ${richfield ? 'STILL PRESENT!' : 'Successfully removed'}`);
