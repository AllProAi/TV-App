#!/usr/bin/env node

/**
 * MemoryStream Development Script
 * 
 * This script starts all components of the MemoryStream application in development mode.
 * Usage: node dev.js [options]
 * 
 * Options:
 *   --backend-only    Start only the backend
 *   --tv-only         Start only the TV app
 *   --mobile-only     Start only the mobile app
 *   --help            Show this help message
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse arguments
const args = process.argv.slice(2);
const options = {
  backendOnly: args.includes('--backend-only'),
  tvOnly: args.includes('--tv-only'),
  mobileOnly: args.includes('--mobile-only'),
  help: args.includes('--help'),
};

// Show help if requested
if (options.help) {
  console.log(`
MemoryStream Development Script

This script starts all components of the MemoryStream application in development mode.
Usage: node dev.js [options]

Options:
  --backend-only    Start only the backend
  --tv-only         Start only the TV app
  --mobile-only     Start only the mobile app
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

// Function to run pnpm command in background
function runPnpmCommand(cwd, command, name) {
  console.log(`Starting ${name}...`);
  
  const child = spawn('pnpm', [command], {
    cwd,
    shell: true,
    stdio: 'pipe',
    detached: false
  });
  
  // Prefix output with component name
  const prefixOutput = (data, prefix, color) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`\x1b[${color}m[${timestamp}] [${prefix}]\x1b[0m ${line}`);
    });
  };
  
  // Handle stdout
  child.stdout.on('data', data => {
    prefixOutput(data, name, getColorCode(name));
  });
  
  // Handle stderr
  child.stderr.on('data', data => {
    prefixOutput(data, name, getColorCode(name));
  });
  
  // Handle process exit
  child.on('close', code => {
    if (code !== 0) {
      console.error(`\x1b[31m[${name}] Process exited with code ${code}\x1b[0m`);
    }
  });
  
  // Handle process error
  child.on('error', error => {
    console.error(`\x1b[31m[${name}] Process error: ${error.message}\x1b[0m`);
  });
  
  return child;
}

// Get color code based on component name
function getColorCode(name) {
  switch (name) {
    case 'Backend':
      return '36'; // Cyan
    case 'TV App':
      return '32'; // Green
    case 'Mobile App':
      return '35'; // Magenta
    default:
      return '37'; // White
  }
}

// Function to start development servers
function startDevServers() {
  const processes = [];
  
  console.log('\x1b[1m=== MemoryStream Development Environment ===\x1b[0m');
  
  // Check if .env file exists in backend folder
  const envPath = path.join(projectRoot, 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('\x1b[33mWarning: .env file not found in backend directory.\x1b[0m');
    console.warn('\x1b[33mAI features may not work without an OpenAI API key.\x1b[0m');
    console.warn('\x1b[33mCreate a .env file with OPENAI_API_KEY=your_key.\x1b[0m');
  }
  
  // Start backend
  if (!options.tvOnly && !options.mobileOnly) {
    processes.push(runPnpmCommand(
      path.join(projectRoot, 'backend'),
      'dev',
      'Backend'
    ));
  }
  
  // Start TV app (with delay to ensure backend is up)
  if (!options.backendOnly && !options.mobileOnly) {
    setTimeout(() => {
      processes.push(runPnpmCommand(
        path.join(projectRoot, 'tv-app'),
        'start',
        'TV App'
      ));
    }, 2000);
  }
  
  // Start mobile app (with delay to ensure backend is up)
  if (!options.backendOnly && !options.tvOnly) {
    setTimeout(() => {
      processes.push(runPnpmCommand(
        path.join(projectRoot, 'mobile-app'),
        'start',
        'Mobile App'
      ));
    }, 3000);
  }
  
  // Print access information after a delay
  setTimeout(() => {
    console.log('\n\x1b[1m=== Development Servers Running ===\x1b[0m');
    
    if (!options.tvOnly && !options.mobileOnly) {
      console.log('\x1b[36mBackend:\x1b[0m http://localhost:3000');
    }
    
    if (!options.backendOnly && !options.mobileOnly) {
      console.log('\x1b[32mTV App:\x1b[0m http://localhost:8080');
    }
    
    if (!options.backendOnly && !options.tvOnly) {
      console.log('\x1b[35mMobile App:\x1b[0m http://localhost:8081');
    }
    
    console.log('\n\x1b[1mPress Ctrl+C to stop all servers\x1b[0m');
  }, 5000);
  
  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\x1b[1m=== Shutting down MemoryStream servers ===\x1b[0m');
    
    processes.forEach(process => {
      if (!process.killed) {
        process.kill();
      }
    });
    
    process.exit(0);
  };
  
  // Listen for SIGINT (Ctrl+C)
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start development servers
startDevServers(); 