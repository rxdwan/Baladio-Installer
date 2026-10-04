' ──────────────────────────────────────────
'  Lofi Beats — Silent Launcher
'  Logs go to: logs\server.log
'  View live logs with: view-logs.bat
' ──────────────────────────────────────────

Dim fso, shell, appDir, logDir, logFile

Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

appDir  = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\Music\music_player"
logDir  = appDir & "\logs"
logFile = logDir & "\server.log"

' Bail early if app folder missing
If Not fso.FolderExists(appDir) Then
    MsgBox "Could not find: " & appDir & Chr(13) & _
           "Make sure your music_player folder is inside your Music folder.", _
           vbCritical, "Lofi Beats"
    WScript.Quit 1
End If

' Create logs folder if needed
If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If

' Stamp the log so you can tell when the server (re)started
Dim logStream
Set logStream = fso.OpenTextFile(logFile, 8, True) ' 8 = append
logStream.WriteLine String(60, "-")
logStream.WriteLine "[STARTED] " & Now()
logStream.WriteLine String(60, "-")
logStream.Close

' Launch node — window hidden (0), don't wait (False)
shell.Run "cmd /c cd /d """ & appDir & """ && node server.js >> """ & logFile & """ 2>&1", 0, False