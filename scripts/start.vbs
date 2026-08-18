Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(scriptDir, "start.bat")
WshShell.Run "cmd /c """ & batPath & """", 0, False
Set WshShell = Nothing
