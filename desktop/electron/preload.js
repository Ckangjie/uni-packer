const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),
  listen: (channel, callback) => {
    const subscription = (_event, payload) => {
      try {
        callback({ payload });
      } catch (err) {
        console.error(`[preload] 事件 ${channel} 监听回调异常:`, err);
      }
    };
    ipcRenderer.on(channel, subscription);
    return Promise.resolve(() => {
      ipcRenderer.removeListener(channel, subscription);
    });
  },
});
