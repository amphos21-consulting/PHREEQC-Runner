# PHREEQC Runner

Run PHREEQC on the input file you are editing with one click.

## Installation

You need:

- VS Code 1.80 or later.
- PHREEQC for Windows, installed from the [USGS PHREEQC page](https://www.usgs.gov/software/phreeqc-version-3). The default location, `C:\Program Files\USGS`, is found automatically.
- Recommended: the [PHREEQC extension](https://marketplace.visualstudio.com/items?itemName=VitorCantarella.phreeqc-syntax) by Vitor Cantarella, for syntax highlighting, autocomplete and hover help. If it isn't installed, PHREEQC Runner offers to install it at startup. Choose **Don't Ask Again** to stop the offer.

1. In VS Code, open the Extensions view (`Ctrl+Shift+X`), search for **PHREEQC Runner** and click **Install**. It is also on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Amphos21ConsultingSL.phreeqc-runner) and on [Open VSX](https://open-vsx.org/extension/Amphos21ConsultingSL/phreeqc-runner). Or install it from a terminal:

   ```powershell
   code --install-extension Amphos21ConsultingSL.phreeqc-runner
   ```

2. Open a `.pqi` file: the **▷ Run PHREEQC** button should appear at the top right of the editor.

If PHREEQC is installed somewhere other than `C:\Program Files\USGS`, run **Select PHREEQC Installation Folder…** from the Command Palette (`Ctrl+Shift+P`), or set `phreeqcRunner.installationPath` (see [Settings](#settings)).

VS Code installs updates automatically. To uninstall, go to the Extensions view, find **PHREEQC Runner** and click **Uninstall**.

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

Clone the repository, edit `extension.js` or `package.json`, then build and install a local package. With Python 3 (no Node.js needed):

```powershell
git clone https://github.com/amphos21-consulting/PHREEQC-Runner.git
cd PHREEQC-Runner
py package_vsix.py
code --install-extension phreeqc-runner-<version>.vsix
```

With Node.js you can use `npx @vscode/vsce package --no-dependencies` instead of `py package_vsix.py`.

### Releasing

Every push and pull request is packaged by GitHub Actions. The `.vsix` can be downloaded from the run's artifacts. To publish a new version to the Visual Studio Marketplace and Open VSX:

1. Raise `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Merge or push the change to `main`.

Each push to `main` publishes the package to both registries and creates a GitHub release `v<version>` with the `.vsix` attached. If that version is already published, the push publishes nothing, so remember to raise `version` for every release. Pushes to other branches and pull requests are only packaged. The workflow needs the `VSCE_PAT` and `OVSX_PAT` secrets in the repository's `release` environment.

## Author

Developed by [Miquel de la Iglesia](https://github.com/miquel25) at Amphos 21 Consulting S.L.

## License

Copyright (C) 2026 Amphos 21 Consulting S.L.

PHREEQC Runner is free software, released under the [GNU General Public License v3.0 or later](LICENSE).
