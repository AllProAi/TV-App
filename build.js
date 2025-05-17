#!/usr/bin/env node

/**
 * MemoryStream Build Script
 * 
 * This script builds all components of the MemoryStream application.
 * Usage: node build.js [options]
 * 
 * Options:
 *   --backend-only    Build only the backend
 *   --tv-only         Build only the TV app
 *   --mobile-only     Build only the mobile app
 *   --production      Build for production (default is development)
 *   --help            Show this help message
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse arguments
const args = process.argv.slice(2);
const options = {
  backendOnly: args.includes('--backend-only'),
  tvOnly: args.includes('--tv-only'),
  mobileOnly: args.includes('--mobile-only'),
  production: args.includes('--production'),
  help: args.includes('--help'),
};

// Show help if requested
if (options.help) {
  console.log(`
MemoryStream Build Script

This script builds all components of the MemoryStream application.
Usage: node build.js [options]

Options:
  --backend-only    Build only the backend
  --tv-only         Build only the TV app
  --mobile-only     Build only the mobile app
  --production      Build for production (default is development)
  --help            Show this help message
  `);
  process.exit(0);
}

// Validate project structure
const projectRoot = process.cwd();
const components = ['backend', 'tv-app', 'mobile-app'];

components.forEach(component => {
  const componentPath = path.join(projectRoot, component);
  if (!fs.existsSync(componentPath)) {
    console.error(`Error: Component directory "${component}" not found.`);
    console.error(`Make sure you're running this script from the project root.`);
    process.exit(1);
  }
  
  const packageJsonPath = path.join(componentPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: package.json not found in "${component}" directory.`);
    process.exit(1);
  }
});

// Function to run pnpm command
function runPnpmCommand(cwd, command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Running: pnpm ${command} ${args.join(' ')} in ${cwd}`);
    
    const child = spawn('pnpm', [command, ...args], {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

// Check if pnpm is installed
function checkPnpm() {
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Build components
async function buildComponents() {
  if (!checkPnpm()) {
    console.error('Error: pnpm is not installed. Please install it by running: npm install -g pnpm');
    process.exit(1);
  }
  
  console.log('=== MemoryStream Build Process ===');
  console.log(`Build mode: ${options.production ? 'Production' : 'Development'}`);
  
  try {
    // Build backend
    if (!options.tvOnly && !options.mobileOnly) {
      console.log('\n=== Building Backend ===');
      await runPnpmCommand(
        path.join(projectRoot, 'backend'),
        options.production ? 'build' : 'build:dev'
      );
    }
    
    // Build TV app
    if (!options.backendOnly && !options.mobileOnly) {
      console.log('\n=== Building TV App ===');
      await runPnpmCommand(
        path.join(projectRoot, 'tv-app'),
        'build',
        options.production ? ['--mode', 'production'] : ['--mode', 'development']
      );
    }
    
    // Build mobile app
    if (!options.backendOnly && !options.tvOnly) {
      console.log('\n=== Building Mobile App ===');
      await runPnpmCommand(
        path.join(projectRoot, 'mobile-app'),
        'build',
        options.production ? ['--mode', 'production'] : ['--mode', 'development']
      );
    }
    
    console.log('\n=== Build Complete ===');
    console.log('Build artifacts:');
    
    if (!options.tvOnly && !options.mobileOnly) {
      console.log('- Backend: backend/dist/');
    }
    
    if (!options.backendOnly && !options.mobileOnly) {
      console.log('- TV App: tv-app/dist/');
    }
    
    if (!options.backendOnly && !options.tvOnly) {
      console.log('- Mobile App: mobile-app/dist/');
    }
    
  } catch (error) {
    console.error('\nBuild failed:', error.message);
    process.exit(1);
  }
}

// Start the build process
buildComponents(); 