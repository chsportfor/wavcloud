const path = require('node:path');
const electron = require('electron');
const { APP_ID } = require('./policy.cjs');
const { createApplication } = require('./application.cjs');
const { app } = electron;
app.setName('WavCloud');
app.setAppUserModelId(APP_ID);
app.enableSandbox();
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => createApplication(electron, path.join(app.getPath('userData'), 'window-state.json')).start())
    .catch(error => { console.error('WavCloud startup failed:', error.message); app.exit(1); });
}
