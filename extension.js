'use strict';

const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SECTION = 'phreeqcRunner';

// Recommended companion: highlighting, autocomplete and hover help for PHREEQC files.
const SYNTAX_EXTENSION = 'VitorCantarella.phreeqc-syntax';
const SYNTAX_DECLINED_KEY = 'syntaxExtensionDeclined';

// Places to look for the executable inside an installation folder, best first.
// bin/Release is the plain console build; bin/ClrRelease is the .NET build with charts.
const EXE_CANDIDATES = process.platform === 'win32'
  ? ['bin/Release/phreeqc.exe', 'bin/phreeqc.exe', 'Release/phreeqc.exe', 'phreeqc.exe',
    'bin/ClrRelease/phreeqc.exe', 'ClrRelease/phreeqc.exe']
  : ['bin/phreeqc', 'phreeqc'];

// PHREEQC prints a banner framed with these block characters on every run.
const BANNER_CHARS = /[║▀▄█]/;

/** Runs in progress, keyed by the input file's URI string (the `resource` context key). */
const runs = new Map();

/** @type {vscode.OutputChannel} */
let log;

function activate(context) {
  log = vscode.window.createOutputChannel('PHREEQC', 'log');
  context.subscriptions.push(
    log,
    vscode.commands.registerCommand(`${SECTION}.run`, runPhreeqc),
    vscode.commands.registerCommand(`${SECTION}.stop`, stopPhreeqc),
    vscode.commands.registerCommand(`${SECTION}.selectInstallation`, selectInstallation),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(`${SECTION}.inputExtensions`)) publishInputExtensions();
    }),
    { dispose: () => runs.forEach(run => run.child?.kill()) },
  );
  publishInputExtensions();
  publishRunning();
  void recommendSyntaxExtension(context);
}

function deactivate() {}

/** Suggests the PHREEQC syntax extension until it is installed or the user declines it. */
function recommendSyntaxExtension(context) {
  if (vscode.extensions.getExtension(SYNTAX_EXTENSION) || context.globalState.get(SYNTAX_DECLINED_KEY)) return;
  return notify('info',
    'PHREEQC Runner recommends the PHREEQC extension by Vitor Cantarella for syntax highlighting, autocomplete and hover help in input files.', {
      'Install': async () => {
        try {
          await vscode.commands.executeCommand('workbench.extensions.installExtension', SYNTAX_EXTENSION);
        } catch (error) {
          vscode.window.showErrorMessage(`The PHREEQC extension could not be installed: ${error.message}`);
        }
      },
      'Show Extension': () => vscode.commands.executeCommand('extension.open', SYNTAX_EXTENSION),
      "Don't Ask Again": () => context.globalState.update(SYNTAX_DECLINED_KEY, true),
    });
}

/** Runs PHREEQC on `uri`, or on the active editor's file when called without one. */
async function runPhreeqc(uri) {
  const target = uri instanceof vscode.Uri ? uri : vscode.window.activeTextEditor?.document.uri;
  if (!target || target.scheme !== 'file') {
    vscode.window.showWarningMessage('Open a PHREEQC input file that is saved on disk, then run it.');
    return;
  }
  const key = target.toString();
  const name = path.basename(target.fsPath);
  if (runs.has(key)) {
    const choice = await vscode.window.showInformationMessage(`PHREEQC is already running ${name}.`, 'Stop It');
    if (choice === 'Stop It') stopRun(runs.get(key));
    return;
  }

  // Register the run straight away so that a double click cannot start it twice.
  const run = { name, dir: path.dirname(target.fsPath), child: undefined, stopped: false };
  runs.set(key, run);
  publishRunning();
  try {
    await execute(run, target);
  } catch (error) {
    vscode.window.showErrorMessage(`PHREEQC Runner: ${error.message}`);
  } finally {
    runs.delete(key);
    publishRunning();
  }
}

async function execute(run, target) {
  const cfg = vscode.workspace.getConfiguration(SECTION, target);
  const { name: inputName, dir } = run;

  const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === target.toString());
  if (doc?.isDirty && cfg.get('saveBeforeRun', true) && !(await doc.save())) {
    vscode.window.showWarningMessage(`${inputName} could not be saved, so PHREEQC was not started.`);
    return;
  }

  const phreeqc = findPhreeqc(cfg.get('installationPath', ''));
  if (phreeqc.error) {
    void offerFix(phreeqc.error, 'installationPath');
    return;
  }

  let inputText;
  try {
    inputText = fs.readFileSync(target.fsPath, 'utf8');
  } catch (error) {
    vscode.window.showErrorMessage(`Cannot read ${inputName}: ${error.message}`);
    return;
  }
  const database = chooseDatabase(inputText, dir, cfg.get('database', ''), phreeqc.exe);
  if (database.error) {
    void offerFix(`${inputName}: ${database.error}`, 'database');
    return;
  }

  const outputName = outputNameFor(inputName, cfg.get('outputExtension', '.pqo'));
  if (outputName.toLowerCase() === inputName.toLowerCase()) {
    void offerFix(`The output file would overwrite ${inputName}. Choose another output extension.`, 'outputExtension');
    return;
  }
  if (run.stopped) return;

  log.appendLine('');
  log.appendLine(`[${new Date().toLocaleTimeString()}] ${inputName}`);
  log.appendLine(`Folder:   ${dir}`);
  log.appendLine(`PHREEQC:  ${phreeqc.exe}${phreeqc.autodetected ? '  (auto-detected)' : ''}`);
  log.appendLine(`Database: ${database.path || `${database.fromInput}  (DATABASE line in the input)`}`);
  log.appendLine(`Output:   ${outputName}`);
  log.appendLine('');

  const args = [inputName, outputName];
  if (database.path) args.push(database.path);
  const before = listFiles(dir);
  const started = Date.now();
  const screen = { errors: [], warnings: 0, prompt: undefined, lastBlank: true };
  const outcome = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: `PHREEQC: ${inputName}` },
    () => spawnPhreeqc(run, phreeqc.exe, args, screen),
  );
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (outcome.error) {
    log.appendLine(`Could not start PHREEQC: ${outcome.error.message}`);
    void offerFix(`Could not start PHREEQC (${phreeqc.exe}): ${outcome.error.message}`, 'installationPath');
    return;
  }
  if (run.stopped) {
    log.appendLine(`Stopped after ${seconds} s.`);
    vscode.window.setStatusBarMessage(`PHREEQC: stopped ${inputName}`, 5000);
    return;
  }
  if (screen.prompt) {
    const reason = screen.errors[screen.errors.length - 1] || screen.prompt;
    log.appendLine(`Stopped: PHREEQC asked on the console for another file name ("${screen.prompt}").`);
    log.show(true);
    void notify('error', `PHREEQC could not open a file needed by ${inputName}: ${reason}`, {
      'Show Log': () => log.show(),
    });
    return;
  }

  const outputPath = path.join(dir, outputName);
  if (outcome.code !== 0 || screen.errors.length > 0) {
    const detail = screen.errors.length
      ? `${count(screen.errors.length, 'error')}: ${screen.errors[0]}`
      : `exit code ${outcome.code ?? outcome.signal}`;
    log.appendLine(`Failed after ${seconds} s with ${detail}`);
    log.show(true);
    void notify('error', `PHREEQC stopped on ${inputName} with ${detail}`, {
      'Show Log': () => log.show(),
      'Open Output': () => openFile(outputPath),
    });
    return;
  }

  // Anything else the run wrote next to the input is selected output (or a DUMP file).
  const skip = new Set([inputName, outputName, 'phreeqc.log'].map(n => n.toLowerCase()));
  const extraOutputs = changedFiles(dir, before)
    .filter(n => !skip.has(n.toLowerCase()))
    .map(n => path.join(dir, n));
  const warnings = screen.warnings ? ` with ${count(screen.warnings, 'warning')}` : '';
  log.appendLine(`Finished in ${seconds} s${warnings}.`);
  if (extraOutputs.length) log.appendLine(`Also written: ${extraOutputs.map(f => path.basename(f)).join(', ')}`);

  const openAfter = cfg.get('openAfterRun', 'output');
  if (openAfter === 'output') await openFile(outputPath, true);
  if (openAfter === 'selectedOutput') for (const file of extraOutputs) await openFile(file, true);

  const actions = { 'Open Output': () => openFile(outputPath) };
  if (extraOutputs.length) actions['Open Selected Output'] = () => openOneOf(extraOutputs);
  if (screen.warnings) actions['Show Log'] = () => log.show();
  void notify('info', `PHREEQC finished ${inputName} in ${seconds} s${warnings}.`, actions);
}

/** Starts PHREEQC and resolves with { code, signal } when it exits, or { error } if it cannot start. */
function spawnPhreeqc(run, exe, args, screen) {
  return new Promise(resolve => {
    let child;
    try {
      child = cp.spawn(exe, args, {
        cwd: run.dir,
        // stdin stays closed: PHREEQC must never wait for console input.
        stdio: ['ignore', 'pipe', 'pipe'],
        // Hiding the process also hides the first window it opens, which for the
        // .NET build (bin\ClrRelease) is its USER_GRAPH chart.
        windowsHide: !/clrrelease/i.test(exe),
      });
    } catch (error) {
      resolve({ error });
      return;
    }
    run.child = child;
    for (const stream of [child.stdout, child.stderr]) {
      const lines = lineSplitter(line => onScreenLine(line, run, screen));
      stream.setEncoding('utf8');
      stream.on('data', lines.push);
      stream.on('end', lines.flush);
    }
    child.on('error', error => {
      if (child.pid === undefined) resolve({ error });
      else log.appendLine(`ERROR: ${error.message}`);
    });
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

/** Logs one line of PHREEQC's console output and tallies errors and warnings. */
function onScreenLine(raw, run, screen) {
  if (screen.prompt) return;
  const text = raw.replace(/\r+$/, '');
  const line = text.slice(text.lastIndexOf('\r') + 1).trimEnd();
  if (BANNER_CHARS.test(line)) return;
  if (!line && screen.lastBlank) return;
  screen.lastBlank = !line;
  log.appendLine(line);

  if (line.startsWith('ERROR:')) {
    screen.errors.push(line.slice('ERROR:'.length).trim());
  } else if (line.startsWith('WARNING:')) {
    screen.warnings++;
  } else if (/^Name of .*file\?/i.test(line)) {
    // PHREEQC asks for another name when it cannot open a file, and with stdin
    // closed it would keep asking forever.
    screen.prompt = line;
    run.child?.kill();
  }
}

function lineSplitter(onLine) {
  let pending = '';
  return {
    push: chunk => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      lines.forEach(line => onLine(line));
    },
    flush: () => {
      if (pending) onLine(pending);
      pending = '';
    },
  };
}

/** Stops the run of `uri`, or, from the Command Palette, asks which run to stop. */
async function stopPhreeqc(uri) {
  if (uri instanceof vscode.Uri) {
    stopRun(runs.get(uri.toString()));
    return;
  }
  const active = [...runs.values()];
  if (active.length <= 1) {
    stopRun(active[0]);
    return;
  }
  const pick = await vscode.window.showQuickPick(
    active.map(run => ({ label: run.name, description: run.dir, run })),
    { placeHolder: 'Which PHREEQC run should be stopped?' },
  );
  stopRun(pick?.run);
}

function stopRun(run) {
  if (!run) return;
  run.stopped = true;
  run.child?.kill();
}

/** Lets the user pick the installation folder and stores it in the user settings. */
async function selectInstallation() {
  const usgs = process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'USGS');
  const picked = await vscode.window.showOpenDialog({
    title: 'Select your PHREEQC installation folder',
    openLabel: 'Use This Folder',
    canSelectFiles: false,
    canSelectFolders: true,
    defaultUri: usgs && isDirectory(usgs) ? vscode.Uri.file(usgs) : undefined,
  });
  if (!picked?.length) return;
  const folder = picked[0].fsPath;
  const found = findPhreeqc(folder);
  if (found.error) {
    vscode.window.showErrorMessage(found.error);
    return;
  }
  await vscode.workspace.getConfiguration(SECTION)
    .update('installationPath', folder, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`PHREEQC Runner will use ${found.exe}.`);
}

/**
 * Resolves the executable from the installationPath setting (an installation folder
 * or the executable itself). When the setting is empty, looks for a standard USGS
 * installation and then the PATH. Returns { exe, autodetected } or { error }.
 */
function findPhreeqc(setting) {
  const configured = expandHome(String(setting ?? '').trim());
  if (configured) {
    if (isFile(configured)) {
      return /\.(bat|cmd)$/i.test(configured)
        ? { error: `Set the PHREEQC installation path to the installation folder or to phreeqc.exe, not to ${path.basename(configured)}.` }
        : { exe: configured };
    }
    if (!isDirectory(configured)) return { error: `The PHREEQC installation path does not exist: ${configured}` };
    const exe = exeInFolder(configured);
    return exe ? { exe } : { error: `No PHREEQC executable was found in ${configured}.` };
  }
  for (const folder of [...standardInstallFolders(), ...pathFolders()]) {
    const exe = exeInFolder(folder);
    if (exe) return { exe, autodetected: true };
  }
  return { error: 'PHREEQC was not found. Select your PHREEQC installation folder.' };
}

function exeInFolder(folder) {
  return EXE_CANDIDATES.map(candidate => path.join(folder, candidate)).find(isFile);
}

/** USGS installations under Program Files, newest version first (Windows only). */
function standardInstallFolders() {
  if (process.platform !== 'win32') return [];
  const bases = [process.env.ProgramW6432, process.env.ProgramFiles, process.env['ProgramFiles(x86)']];
  const folders = [];
  for (const base of new Set(bases.filter(Boolean))) {
    const usgs = path.join(base, 'USGS');
    let names;
    try {
      names = fs.readdirSync(usgs);
    } catch {
      continue;
    }
    names
      .filter(n => /^phreeqc-\d/i.test(n))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .forEach(n => folders.push(path.join(usgs, n)));
  }
  return folders;
}

function pathFolders() {
  return (process.env.PATH || '').split(path.delimiter).map(d => d.replace(/^"(.*)"$/, '$1')).filter(Boolean);
}

/**
 * Picks the database argument. PHREEQC prefers a DATABASE line in the input, so no
 * argument is passed then. Otherwise one is always passed, because without it
 * PHREEQC asks for a database name on the console.
 */
function chooseDatabase(inputText, dir, setting, exe) {
  const keyword = /^[ \t]*DATABASE[ \t]+([^#\r\n]*)/im.exec(inputText);
  if (keyword) return { fromInput: keyword[1].trim() };

  const configured = expandHome(String(setting ?? '').trim());
  if (configured) {
    const file = path.resolve(dir, configured);
    return isFile(file) ? { path: file } : { error: `the database set in PHREEQC Runner's settings does not exist: ${file}` };
  }
  const fromEnv = process.env.PHREEQC_DATABASE;
  const fallback = fromEnv && isFile(fromEnv) ? fromEnv : defaultDatabase(exe);
  return fallback
    ? { path: fallback }
    : { error: 'there is no DATABASE line in the input and no default phreeqc.dat was found. Add a DATABASE line or set a database.' };
}

/** phreeqc.dat of the installation that `exe` belongs to, if any. */
function defaultDatabase(exe) {
  let dir = path.dirname(exe);
  for (let level = 0; level < 4; level++) {
    const candidate = path.join(dir, 'database', 'phreeqc.dat');
    if (isFile(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  // Layout of a Linux/macOS "make install".
  const shared = path.resolve(path.dirname(exe), '..', 'share', 'doc', 'phreeqc', 'database', 'phreeqc.dat');
  return isFile(shared) ? shared : undefined;
}

function outputNameFor(inputName, extension) {
  let ext = String(extension || '.pqo').trim();
  if (!ext.startsWith('.')) ext = `.${ext}`;
  return path.basename(inputName, path.extname(inputName)) + ext;
}

/** Name → "mtime:size" of the files directly in `dir`, to find out what a run wrote. */
function listFiles(dir) {
  const files = new Map();
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      const stat = fs.statSync(path.join(dir, entry.name));
      files.set(entry.name, `${stat.mtimeMs}:${stat.size}`);
    } catch {
      // Deleted in the meantime.
    }
  }
  return files;
}

function changedFiles(dir, before) {
  return [...listFiles(dir)]
    .filter(([name, stamp]) => before.get(name) !== stamp)
    .map(([name]) => name)
    .sort();
}

async function openFile(file, preserveFocus = false) {
  if (!isFile(file)) {
    vscode.window.showWarningMessage(`${path.basename(file)} was not written.`);
    return;
  }
  try {
    await vscode.window.showTextDocument(vscode.Uri.file(file),
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus, preview: false });
  } catch (error) {
    vscode.window.showErrorMessage(`Cannot open ${path.basename(file)}: ${error.message}`);
  }
}

async function openOneOf(files) {
  if (files.length === 1) {
    await openFile(files[0]);
    return;
  }
  const pick = await vscode.window.showQuickPick(
    files.map(file => ({ label: path.basename(file), file })),
    { placeHolder: 'Which file should be opened?' },
  );
  if (pick) await openFile(pick.file);
}

/** Shows a notification whose buttons are the keys of `actions`, and runs the chosen one. */
async function notify(level, message, actions) {
  const buttons = Object.keys(actions);
  const choice = level === 'error'
    ? await vscode.window.showErrorMessage(message, ...buttons)
    : await vscode.window.showInformationMessage(message, ...buttons);
  if (choice) await actions[choice]();
}

/** Shows a setup error with buttons that lead to the setting that fixes it. */
function offerFix(message, setting) {
  const actions = {};
  if (setting === 'installationPath') actions['Select Folder…'] = selectInstallation;
  actions['Open Settings'] = () =>
    vscode.commands.executeCommand('workbench.action.openSettings', `${SECTION}.${setting}`);
  return notify('error', message, actions);
}

/** Publishes the configured extensions for the `resourceExtname in …` menu conditions. */
function publishInputExtensions() {
  const configured = vscode.workspace.getConfiguration(SECTION).get('inputExtensions', []);
  const extensions = new Set();
  for (const value of Array.isArray(configured) ? configured : []) {
    let ext = String(value).trim();
    if (ext && !ext.startsWith('.')) ext = `.${ext}`;
    // The condition is case-sensitive, so also accept the all-lower and all-upper spelling.
    [ext, ext.toLowerCase(), ext.toUpperCase()].forEach(e => extensions.add(e));
  }
  vscode.commands.executeCommand('setContext', `${SECTION}.inputExtensions`, [...extensions]);
}

function publishRunning() {
  vscode.commands.executeCommand('setContext', `${SECTION}.runningFiles`, [...runs.keys()]);
  vscode.commands.executeCommand('setContext', `${SECTION}.running`, runs.size > 0);
}

function expandHome(p) {
  return p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? path.join(os.homedir(), p.slice(1)) : p;
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function count(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

module.exports = { activate, deactivate };
