# Copyright (C) 2026 Amphos 21 Consulting S.L.
#
# This program is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
# PARTICULAR PURPOSE. See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with
# this program. If not, see <https://www.gnu.org/licenses/>.

"""Package this folder as a .vsix that VS Code can install, without Node.js or vsce.

    py package_vsix.py
    code --install-extension phreeqc-runner-<version>.vsix
"""
import json
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
FILES = [
    "package.json", "extension.js", "README.md", "language-configuration.json",
    "CHANGELOG.md",
    "images/icon.png", "images/phreeqc.png", "images/phreeqc-output.png",
    "syntaxes/phreeqc-output.tmLanguage.json", "syntaxes/phreeqc-database.tmLanguage.json",
]

CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
"""

MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}"/>
    <DisplayName>{display_name}</DisplayName>
    <Description xml:space="preserve">{description}</Description>
    <Tags>{tags}</Tags>
    <Categories>{categories}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{engine}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Source" Value="{repository}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Getstarted" Value="{repository}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.GitHub" Value="{repository}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Support" Value="{bugs}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Learn" Value="{homepage}"/>
    </Properties>
    <License>extension/LICENSE.txt</License>
    <Icon>extension/{icon}</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/{icon}" Addressable="true"/>
  </Assets>
</PackageManifest>
"""


def main():
    pkg = json.loads((HERE / "package.json").read_text(encoding="utf-8"))
    fields = {
        "name": pkg["name"],
        "version": pkg["version"],
        "publisher": pkg["publisher"],
        "display_name": pkg.get("displayName", pkg["name"]),
        "description": pkg.get("description", ""),
        "engine": pkg["engines"]["vscode"],
        "tags": ",".join(pkg.get("keywords", [])),
        "categories": ",".join(pkg.get("categories", [])),
        "icon": pkg["icon"],
        "repository": pkg["repository"]["url"],
        "bugs": pkg["bugs"]["url"],
        "homepage": pkg["homepage"],
    }
    manifest = MANIFEST.format(**{k: escape(v, {'"': "&quot;"}) for k, v in fields.items()})
    target = HERE / f"{pkg['name']}-{pkg['version']}.vsix"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as vsix:
        vsix.writestr("[Content_Types].xml", CONTENT_TYPES)
        vsix.writestr("extension.vsixmanifest", manifest)
        for name in FILES:
            vsix.write(HERE / name, f"extension/{name}")
        # vsce ships the license as LICENSE.txt; do the same.
        vsix.write(HERE / "LICENSE", "extension/LICENSE.txt")
    print(f"Wrote {target}")
    print(f'Install with:  code --install-extension "{target}"')


if __name__ == "__main__":
    main()
