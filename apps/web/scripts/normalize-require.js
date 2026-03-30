// Patch Node.js module resolution to normalize Windows path casing
// This prevents dual module instances caused by case-insensitive filesystem
// Both parent process and spawned workers inherit NODE_OPTIONS so this runs everywhere
'use strict';
const Module = require('module');
const fs = require('fs');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  const resolved = originalResolveFilename.call(this, request, parent, isMain, options);
  if (process.platform === 'win32' && resolved && resolved.includes('\\')) {
    // Normalize to native canonical path (uppercase where Windows says uppercase)
    try {
      return fs.realpathSync.native(resolved);
    } catch (e) {
      return resolved;
    }
  }
  return resolved;
};
