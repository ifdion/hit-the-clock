require('dotenv').config()
const yargs = require('yargs/yargs')
const puppeteer = require('puppeteer');
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

(async () => {
    const mode = (argv.out || argv.clockout || argv.clockOut) ? 'clockOut' : 'clockIn';
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();

    await context.overridePermissions(process.env.MACHINE_PATH, ['geolocation']);

    await page.setViewport({
        width: 1024,
        height: 768,
        deviceScaleFactor: 1,
    });

    try {
        await page.goto(process.env.AUTH_PATH);
        await page.type('#user_email', process.env.EMAIL);
        await page.type('#user_password', process.env.PASSWORD);
        await page.click('#new-signin-button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' })
        await page.goto(process.env.MACHINE_PATH, {
            waitUntil: 'networkidle0'
        });
        await page.setGeolocation({ latitude: -6.9201464, longitude: 107.6816268 });
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('[href="/live-attendance"]'),

        ])
        if (mode === 'clockIn') {
            await page.mouse.click(400, 540)
        } else {
            await page.mouse.click(640, 540)
        }
        await page.screenshot({ path: 'talenta.png' });
        await page.goto(process.env.LOGOUT_PATH);
        await browser.close();

        console.log({ status: 'success' });

    } catch (error) {
        await page.goto(process.env.LOGOUT_PATH);
        await browser.close();

        console.debug(error);
    }
})();