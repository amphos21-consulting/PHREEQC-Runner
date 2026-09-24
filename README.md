# PHREEQC Runner

Run PHREEQC on the input file you are editing with one click.

## Usage

- Open a `.pqi`, `.phr` or `.phrq` file and click the **▷ Run PHREEQC** button at the top right of the editor, or press `Ctrl+F5`.
- You can also right-click the file in the Explorer and choose **Run PHREEQC**. From the Command Palette, **Run PHREEQC** works on any file.
- While a run is going, the button turns into **■ Stop PHREEQC**.

PHREEQC runs in the input file's folder. It writes `<name>.pqo` next to the input, and selected output files are written there too. When the run ends, a notification shows how long it took and has buttons to open the output. Everything PHREEQC prints appears in the **PHREEQC** output panel. If the run fails, that panel opens automatically.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `phreeqcRunner.installationPath` | *(empty)* | Your PHREEQC installation folder (e.g. `C:\Program Files\USGS\phreeqc-3.7.3-15968-x64`) or the `phreeqc.exe` itself. If empty, the newest installation under `C:\Program Files\USGS` is used, then `phreeqc` on the PATH. The command **Select PHREEQC Installation Folder…** sets it for you. |
| `phreeqcRunner.database` | *(empty)* | Database for inputs without a `DATABASE` line: absolute, or relative to the input's folder. If empty, the installation's `database\phreeqc.dat` is used. A `DATABASE` line in the input always wins. |
| `phreeqcRunner.outputExtension` | `.pqo` | Extension of the output file. |
| `phreeqcRunner.inputExtensions` | `.pqi .phr .phrq` | Which files get the Run button and `Ctrl+F5`. |
| `phreeqcRunner.saveBeforeRun` | `true` | Save the input before running. |
| `phreeqcRunner.openAfterRun` | `none` | Open the `.pqo` (`output`) or the selected output (`selectedOutput`) after a successful run. |

## Notes

- If PHREEQC can't open a file (for example a database named in `DATABASE` that doesn't exist), it asks for another name on the console. The extension then stops the run and shows the error, rather than leaving PHREEQC waiting.
- The default executable is `bin\Release\phreeqc.exe`, which doesn't draw `USER_GRAPH` charts. To get charts, set the installation path to `bin\ClrRelease\phreeqc.exe`, the .NET build that `phreeqc.bat` uses. A console window then stays open while PHREEQC runs. This setup hasn't been tested.

## Changing the extension

Edit `extension.js` or `package.json`, raise `version` in `package.json`, then run:

```
py package_vsix.py
code --install-extension phreeqc-runner-<version>.vsix
```

To uninstall, go to the Extensions view, find **PHREEQC Runner** and click **Uninstall**.
