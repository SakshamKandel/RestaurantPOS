KHADKAPOS ADMINISTRATOR PIN RECOVERY

This restores the hidden Administrator login to PIN 8865.
It requires the installed Windows KhadkaPOS app. No Node.js installation,
project files, or internet connection are needed.

1. Close every KhadkaPOS window. Keep the app closed during recovery.
2. Extract the complete recovery ZIP to a normal folder.
   Keep all extracted files and folders together; do not run inside the ZIP.
3. Double-click Restore Administrator PIN.cmd.
4. If asked for KhadkaPOS.exe, right-click the app's desktop shortcut and
   choose Open file location. Copy the full path of KhadkaPOS.exe from that
   folder and paste it into the recovery window, then press Enter.
5. Wait for "Recovery completed successfully."
6. Reopen KhadkaPOS. Click Administrator at the bottom-left of the sign-in
   screen, enter 8865, then click Sign in. Choose the Administrator button,
   rather than a staff or manager account that happens to be named Admin.
7. After signing in, set a new Administrator PIN in Staff Management.

YOUR DATA AND BACKUP

When a PIN change is needed, the tool first creates and verifies a full
database backup beside pos.db. Its path is printed in the recovery window.
Keep that backup. Existing backups are never replaced.
Sales, staff PINs, and other settings are preserved. If the default PIN
already works or no Administrator PIN is saved, no reset or backup is needed.

DEFAULT AND CUSTOM LOCATIONS

The default database is the current Windows user's:
  %APPDATA%\KhadkaPOS\pos.db

The tool looks for KhadkaPOS.exe in the standard per-user and Program Files
installation folders. If it cannot find the app, it asks for the installed
executable's full path.

If support confirms that your database is stored elsewhere, open Command
Prompt and run the launcher with that exact existing database path:
  "C:\Recovery\Restore Administrator PIN.cmd" "D:\POS Data\pos.db"

Use full paths and keep the quotation marks when a path contains spaces.
The tool never searches for another database or creates a replacement.

IF RECOVERY FAILS

Keep KhadkaPOS closed. Share the messages in the recovery window with
support. Do not assume success unless the window confirms it.
Never delete pos.db or its lock files, and do not reinstall to reset the PIN.
