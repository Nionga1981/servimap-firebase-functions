#!/usr/bin/env node

// Deploy single function script to bypass shell issues
const { spawn } = require('child_process');
const path = require('path');

const functionName = process.argv[2] || 'interpretarBusqueda';

console.log(`🚀 Deploying function: ${functionName}`);

const firebaseCmd = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const args = ['deploy', '--only', `functions:${functionName}`];

const firebase = spawn(firebaseCmd, args, {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    SHELL: '/bin/sh'  // Use sh instead of bash
  }
});

firebase.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Deployment successful!');
  } else {
    console.log(`❌ Deployment failed with code ${code}`);
  }
  process.exit(code);
});

firebase.on('error', (error) => {
  console.error('❌ Deployment error:', error);
  process.exit(1);
});