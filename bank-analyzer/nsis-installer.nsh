!include "x64.nsh"
!include "nsDialogs.nsh"

!macro customInstall
  ; Cerrar la aplicación si está corriendo
  nsExec.ExecToLog 'taskkill /IM "Bank Analyzer.exe" /F'
!macroend

!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  SetShellVarContext current
!macroend

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "Bank Analyzer"
  deleteAppDataOnUninstall: false
