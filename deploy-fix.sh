#!/usr/bin/bash
# Firebase Deploy Fix for Windows Git Bash Conflict

echo "🔧 Fixing Git Bash conflict for Firebase deployment..."

# Set correct shell paths
export SHELL=/usr/bin/bash
export BASH=/usr/bin/bash
export PATH=/usr/bin:$PATH

# Clear problematic environment variables
unset GIT_BASH
unset MSYSTEM
unset MSYS2_PATH_TYPE

echo "🚀 Starting Firebase Functions deployment..."

# Change to functions directory and deploy
cd functions
firebase deploy --only functions --project servimap-nyniz

echo "✅ Deployment completed!"