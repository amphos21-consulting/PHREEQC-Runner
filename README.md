# PHREEQC Runner

Run PHREEQC on the input file you are editing with one click.

## Installation

You need:

- VS Code 1.80 or later.
- PHREEQC for Windows, installed from the [USGS PHREEQC page](https://www.usgs.gov/software/phreeqc-version-3). The default location, `C:\Program Files\USGS`, is found automatically.
- Python 3, to build the extension package. Node.js isn't needed.
- Recommended: the [PHREEQC extension](https://marketplace.visualstudio.com/items?itemName=VitorCantarella.phreeqc-syntax) by Vitor Cantarella, for syntax highlighting, autocomplete and hover help. If it isn't installed, PHREEQC Runner offers to install it at startup. Choose **Don't Ask Again** to stop the offer.

1. Clone the repository and build the package:

   ```powershell
   git clone https://gitlab.amphos21.com/miquel.iglesia/vscode-phreeqc-runner.git
   cd vscode-phreeqc-runner
   py package_vsix.py
   ```

   This writes `phreeqc-runner-<version>.vsix` in the same folder.

2. Install it, either from a terminal:

   ```powershell
   code --install-extension phreeqc-runner-<version>.vsix
   ```

   or in VS Code: open the Extensions view (`Ctrl+Shift+X`), click the **⋯** menu at its top, choose **Install from VSIX…** and pick the file.

3. Reload VS Code if it asks you to. Open a `.pqi` file: the **▷ Run PHREEQC** button should appear at the top right of the editor.

If PHREEQC is installed somewhere other than `C:\Program Files\USGS`, run **Select PHREEQC Installation Folder…** from the Command Palette (`Ctrl+Shift+P`), or set `phreeqcRunner.installationPath` (see [Settings](#settings)).

To update, pull the latest changes, then repeat steps 1 and 2. The new version replaces the old one.

To uninstall, go to the Extensions view, find **PHREEQC Runner** and click **Uninstall**.

## Usage

- Open a `.pqi`, `.ppi`, `.phr` or `.phrq` file and click the **▷ Run PHREEQC** button at the top right of the editor, or press `Ctrl+F5`.
- You can also right-click the file in the Explorer and choose **Run PHREEQC**. From the Command Palette, **Run PHREEQC** works on any file.
- While a run is going, the button turns into **■ Stop PHREEQC**.
- Input files (`.pqi`, `.ppi`, `.phr`, `.phrq`) get the blue PHREEQC icon, and output files (`.out`, `.pqo`) the green one, in the Explorer and on editor tabs. Some file icon themes, such as Material Icon Theme, show their own icons instead. Output and database (`.dat`) files keep the PHREEQC extension's highlighting, but not its autocomplete or hover help.

PHREEQC runs in the input file's folder. It writes `<name>.pqo` next to the input, and selected output files are written there too. When the run ends, a notification shows how long it took and has buttons to open the output. Everything PHREEQC prints appears in the **PHREEQC** output panel. If the run fails, that panel opens automatically.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `phreeqcRunner.installationPath` | *(empty)* | Your PHREEQC installation folder (e.g. `C:\Program Files\USGS\phreeqc-3.7.3-15968-x64`) or the `phreeqc.exe` itself. If empty, the newest installation under `C:\Program Files\USGS` is used, then `phreeqc` on the PATH. The command **Select PHREEQC Installation Folder…** sets it for you. |
| `phreeqcRunner.database` | *(empty)* | Database for inputs without a `DATABASE` line: absolute, or relative to the input's folder. If empty, the installation's `database\phreeqc.dat` is used. A `DATABASE` line in the input always wins. |
| `phreeqcRunner.outputExtension` | `.pqo` | Extension of the output file. |
| `phreeqcRunner.inputExtensions` | `.pqi .ppi .phr .phrq` | Which files get the Run button and `Ctrl+F5`. |
| `phreeqcRunner.saveBeforeRun` | `true` | Save the input before running. |
| `phreeqcRunner.openAfterRun` | `output` | Open the `.pqo` (`output`) or the selected output (`selectedOutput`) after a successful run. |

## Notes

- If PHREEQC can't open a file (for example a database named in `DATABASE` that doesn't exist), it asks for another name on the console. The extension then stops the run and shows the error, rather than leaving PHREEQC waiting.
- The default executable is `bin\Release\phreeqc.exe`, which doesn't draw `USER_GRAPH` charts. To get charts, set the installation path to `bin\ClrRelease\phreeqc.exe`, the .NET build that `phreeqc.bat` uses. A console window then stays open while PHREEQC runs. This setup hasn't been tested.

## Changing the extension

Edit `extension.js` or `package.json`, raise `version` in `package.json`, then run:

```
py package_vsix.py
code --install-extension phreeqc-runner-<version>.vsix
```
