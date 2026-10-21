# Full File Viewer

A Vesktop plugin that shows the whole text attachment.

Discord's preview only downloads the first 50 KB. A 2 MB log then ends with `(2 MB left)` even though the file is sitting on Discord's CDN. This plugin asks for the rest of the file and draws it in the same preview window. Big logs are windowed, so the client does not freeze trying to highlight every line.

## Install

Vesktop cannot load a loose plugin file. The script builds a Vencord bundle with this plugin and points Vesktop at it.

Quit Vesktop completely, including the tray icon, then:

```sh
./install.sh
```

Start Vesktop. **Full File Viewer** is enabled. Open a text attachment the same way as before. The expanded preview should say `Full file` in the status bar instead of `(2 MB left)`.

If Vesktop was still open during the build, quit it and run:

```sh
./install.sh apply
```

## Using it

- Search with Ctrl+F, or the search icon that appears when you hover the preview
- Copy copies the whole file, not just the lines on screen
- Top / End jump through the file
- Wrap follows Discord's word-wrap toggle, and there is a Wrap button on the viewer
- Plugin settings control the size limit (default 25 MB, up to 100 MB). Close and reopen the file after changing it

Files under the old 50 KB cap still use Discord's normal preview, including syntax highlighting.

## Update

```sh
git -C ~/.local/share/full-file-viewer/Vencord pull
./install.sh
```

Quit Vesktop first if `apply` says it is still running.

## Go back to stock Vesktop

Quit Vesktop, then remove the `vencordDir` line from `~/.config/vesktop/state.json` and start it again. Vesktop will use its built-in Vencord.
