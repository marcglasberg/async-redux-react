## How to run a React web app in WebStorm/Windows:

1. Click the text `Current File` (top right of the screen) and select `Edit Configurations...`
2. Press `+` and select `npm`
3. Change fields:
    - Name: `npm start`
    - Package.json: `~\Documents\GitHub\async-redux-react\examples\todo-app-example\package.json`
    - Command: `run`
    - Scripts: `dev`
    - Arguments: ``
    - Node interpreter: `Project node ([path]\nodejs\node.exe)`
    - Package manager: `Project [path]\nodejs\npm.cmd`
    - Environment: ``
    - Before launch: ``
    - Show this page: OFF
    - Activate tool window: ON
    - Focus tool window: OFF
4. Press `OK`.
5. Click the play button next to `npm start` (top right of the screen)
