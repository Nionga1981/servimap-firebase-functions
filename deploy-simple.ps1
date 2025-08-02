$env:SHELL = ""
firebase deploy --only functions
firebase functions:list