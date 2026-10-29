#!/usr/bin/env node
// Builds / updates the one page that holds every template of a run in page order, trashes the temporary preview page.
//   node process/scripts/assemble-page.mjs <fileKey> <node-id> [--final]     --final prints the "HOÀN TẤT" message (after the fix loop)
import { assemblePage } from '../shared/deliverable.mjs';

const [fileKey, node] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!fileKey || !node) { console.error('usage: node process/scripts/assemble-page.mjs <fileKey> <node-id> [--final]'); process.exit(1); }
await assemblePage(fileKey, node, { final: process.argv.includes('--final') });
