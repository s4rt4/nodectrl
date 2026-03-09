Dim ws, scriptDir
Set ws = CreateObject("WScript.Shell")

' Get the folder where this .vbs file lives
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Run start.bat silently (0 = hidden window)
ws.Run "cmd /c """ & scriptDir & "\start.bat""", 0, False
