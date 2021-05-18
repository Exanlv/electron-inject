const fs = require('fs');
const WebSocket = require('ws');
const fetch = require('node-fetch');

fs.readdir(__dirname + '/inject', (err, dirs) => {
    if (err)
        throw err;

    dirs.forEach((dir) => {
        if (dir === '.gitkeep') return;

        injectPort(dir);
    });
});

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

async function injectPort(port) {
    const portDir = `${__dirname}/inject/${port}`;

    const regexp = new RegExp(fs.readFileSync(`${portDir}/regexp`).toString());

    const websocketUrl = await getWebsocketUrl(port, regexp);

    console.log(websocketUrl);

    if (!websocketUrl) {
        return;
    }

    const ws = new WebSocket(websocketUrl, { perMessageDeflate: false });

    await new Promise(resolve => ws.once('open', resolve));

    ws.on('message', async (msg) => {
        const message = JSON.parse(msg);

        switch (message.id) {
            case 1:
                ws.send(JSON.stringify({
                    id: 2,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: fs.readFileSync(`${__dirname}/injectCss.js`).toString()
                    },
                }));
                break;
            case 3:
                console.log(message);
        }
    });

    const cssDir = `${portDir}/css`;

    if (fs.existsSync(cssDir)) {
        const css = [];

        const cssFiles = fs.readdirSync(cssDir);
    
        cssFiles.forEach((cssFile) => {
            css.push(fs.readFileSync(`${cssDir}/${cssFile}`).toString());
        });
    
        ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
                expression: `var css = ${JSON.stringify(css.join('\n'))}`
            }
        }))
    }
    
    const jsDir = `${portDir}/js`;

    if (fs.existsSync(jsDir)) {
        const jsFiles = fs.readdirSync(jsDir);

        jsFiles.forEach((jsFile) => {
            ws.send(JSON.stringify({
                id: 3,
                method: 'Runtime.evaluate',
                params: {
                    expression: fs.readFileSync(`${jsDir}/${jsFile}`).toString()
                }
            }))
        });
    }
}

async function getWebsocketUrl(port, regexp) {
    try {
        const appData = await (await fetch(`http://localhost:${port}/json/list`)).json();

        const windowData = appData.find((wd) => {
            return wd.url.match(regexp);
        });

        if (!windowData) {
            await sleep(1000);

            if (process.uptime > 20) {
                return;
            }
        }

        return windowData.webSocketDebuggerUrl;
    } catch (e) {
        await sleep(1000);

        if (process.uptime > 20) {
            return;
        }

        return getWebsocketUrl(port, regexp);
    }
}