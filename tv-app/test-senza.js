// Simple test to check if Senza SDK is properly installed
const senza = require('senza-sdk');

console.log('Senza SDK version:', senza.version || 'Not found');
console.log('Senza SDK functions available:');
console.log('- init:', typeof senza.init === 'function');
console.log('- uiReady:', typeof senza.uiReady === 'function');
console.log('- app:', typeof senza.app === 'object');
console.log('- player:', typeof senza.player === 'object');

console.log('\nAll Senza SDK properties:');
console.log(Object.keys(senza)); 