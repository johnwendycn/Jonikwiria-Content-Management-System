const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDevToolsTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function loginAndGetToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'root-administrator@system.local',
      password: 'SuperAdmin@123'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.data?.sessionToken) {
            resolve(json.data.sessionToken);
          } else {
            reject(new Error(json.message || 'Login failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Fetching auth session token from backend...');
  let token;
  try {
    token = await loginAndGetToken();
    console.log('Successfully logged in! Session Token:', token.substring(0, 15) + '...');
  } catch (err) {
    console.error('Failed to log in to backend API:', err.message);
    process.exit(1);
  }

  const chromeProfileDir = 'C:\\Users\\PC\\AppData\\Local\\Temp\\chrome-profile-stream-' + Date.now();
  if (!fs.existsSync(chromeProfileDir)) {
    fs.mkdirSync(chromeProfileDir, { recursive: true });
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1200,900',
    '--user-data-dir=' + chromeProfileDir,
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    'http://localhost:8081'
  ]);

  chrome.stdout.on('data', (data) => {
    console.log('[CHROME STDOUT]', data.toString());
  });
  chrome.stderr.on('data', (data) => {
    console.error('[CHROME STDERR]', data.toString());
  });

  chrome.on('error', (err) => {
    console.error('Failed to start Chrome:', err);
    process.exit(1);
  });

  console.log('Waiting 5 seconds for Headless Chrome to start...');
  await delay(5000);

  let targets;
  try {
    targets = await getDevToolsTargets();
  } catch (err) {
    console.error('Failed to connect to DevTools:', err);
    chrome.kill();
    process.exit(1);
  }

  const target = targets.find(t => t.url.includes('localhost:8081'));
  if (!target) {
    console.error('Target page localhost:8081 not found in DevTools targets list.');
    chrome.kill();
    process.exit(1);
  }

  console.log('Connecting to DevTools Protocol WebSocket...');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let messageId = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.method === 'Console.messageAdded') {
        console.log('[BROWSER CONSOLE]', msg.params.message.text);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const argsStr = msg.params.args ? msg.params.args.map(a => JSON.stringify(a.value || a.description || '')).join(' ') : '';
        console.log('[BROWSER CONSOLE]', argsStr);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
      }

      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(msg.error);
        } else {
          resolve(msg);
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('open', async () => {
    try {
      await sendCommand('Runtime.enable');
      await sendCommand('Console.enable');
      await sendCommand('Page.enable');
      console.log('DevTools session initialized successfully.');

      console.log('Injecting streaming credentials and routing keys...');
      const injectScript = `
        window.localStorage.setItem('cms_session_token', ${JSON.stringify(token)});
        window.localStorage.setItem('cms_active_screen', 'mother_website');
        window.localStorage.setItem('mother_active_screen', 'live_stream');
        window.localStorage.setItem('mother_route_params', JSON.stringify({ streamId: 'verify-room', isHost: true }));
      `;
      await sendCommand('Runtime.evaluate', { expression: injectScript });

      console.log('Reloading page to launch host broadcast...');
      await sendCommand('Page.reload');

      console.log('Waiting 10 seconds for camera capture and RTC initialization...');
      await delay(10000);

      // Verify that the local video element is rendered and not blank
      const checkVideoScript = `
        (() => {
          const video = document.querySelector('video');
          const badNodes = [];
          document.querySelectorAll('div, span').forEach(el => {
            el.childNodes.forEach(child => {
              if (child.nodeType === 3 && child.nodeValue.trim().length > 0) {
                // If it is inside a react-text wrapper, it's fine, but in RNW
                // text nodes should generally be in elements with specific attributes or we can inspect them.
                badNodes.push({
                  parentTag: el.tagName,
                  parentClass: el.className,
                  text: child.nodeValue,
                  parentId: el.id,
                  outerHTML: el.outerHTML.substring(0, 150)
                });
              }
            });
          });
          
          if (!video) return { status: 'error', reason: 'No video element found in DOM', badNodes };
          
          const hasSrcObject = !!video.srcObject;
          const rect = video.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          return {
            status: 'success',
            hasSrcObject,
            width: rect.width,
            height: rect.height,
            isVisible,
            srcObjectClassName: video.srcObject ? video.srcObject.constructor.name : 'null',
            badNodes
          };
        })()
      `;
      const videoCheckRes = await sendCommand('Runtime.evaluate', { expression: checkVideoScript, returnByValue: true });
      const result = videoCheckRes.result?.result?.value || {};
      
      console.log('\n======================================================');
      console.log('CAMERA STREAM RENDER VERIFICATION RESULTS:');
      console.log('======================================================');
      console.log('Video check:', result);
      
      const isSuccessful = result.status === 'success' && result.isVisible && result.hasSrcObject;
      if (isSuccessful) {
        console.log('✅ Success: The live stream camera element loaded successfully and is active!');
      } else {
        console.log('❌ Failure: The live stream camera element is blank, missing, or inactive.');
      }
      console.log('======================================================\n');

      console.log('Simulating navigation away (clicking About menu in navbar)...');
      const navigateAwayScript = `
        (() => {
          const aboutLinkText = Array.from(document.querySelectorAll('[data-class~="nav-link-text"]')).find(e => e.innerText && e.innerText.trim() === 'About');
          if (!aboutLinkText) return 'About link text not found';
          const clickable = aboutLinkText.closest('[data-class~="nav-link-item"]') || aboutLinkText;
          
          const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
          const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
          const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          
          clickable.dispatchEvent(mousedown);
          clickable.dispatchEvent(mouseup);
          clickable.dispatchEvent(click);
          return 'Dispatched click events to clickable';
        })()
      `;
      const navRes = await sendCommand('Runtime.evaluate', { expression: navigateAwayScript, returnByValue: true });
      console.log('Action:', navRes.result?.result?.value);
      await delay(3000);

      // Check the current screen in local storage to verify navigation occurred
      const checkScreenRes = await sendCommand('Runtime.evaluate', { expression: `window.localStorage.getItem('mother_active_screen')`, returnByValue: true });
      console.log('Active Screen after navigation:', checkScreenRes.result?.result?.value);


      // Verify the Return to Live Stream header button and floating FAB are rendered
      const checkReturnIndicatorScript = `
        (() => {
          const headerBtn = document.querySelector('[data-class~="header-live-btn"]');
          const floatingFab = document.querySelector('[data-class~="floating-stream-fab"]');
          
          return {
            headerBtnExists: !!headerBtn,
            headerBtnText: headerBtn ? headerBtn.innerText : '',
            floatingFabExists: !!floatingFab,
            floatingFabText: floatingFab ? floatingFab.innerText : ''
          };
        })()
      `;
      const indicatorRes = await sendCommand('Runtime.evaluate', { expression: checkReturnIndicatorScript, returnByValue: true });
      const indicators = indicatorRes.result?.result?.value || {};
      console.log('Stream Indicators:', indicators);
      
      const indicatorsOk = indicators.headerBtnExists && indicators.floatingFabExists;
      if (indicatorsOk) {
        console.log('✅ Success: Return-to-stream header button and floating icon are successfully rendered!');
      } else {
        console.log('❌ Failure: Return-to-stream indicators are missing.');
      }

      ws.close();
      chrome.kill();
      try { fs.rmSync(chromeProfileDir, { recursive: true, force: true }); } catch (e) {}
      process.exit(isSuccessful && indicatorsOk ? 0 : 1);
    } catch (e) {
      console.error('Error during test execution:', e);
      ws.close();
      chrome.kill();
      try { fs.rmSync(chromeProfileDir, { recursive: true, force: true }); } catch (e) {}
      process.exit(1);
    }
  });
}

run();
