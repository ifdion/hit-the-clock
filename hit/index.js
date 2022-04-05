require('dotenv').config()
const puppeteer = require('puppeteer');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers')
yargs(hideBin(process.argv))
    .command({
        command:'out',
        describe:'Clock out'
    })
    .parse();
const { argv } = yargs;


(async () => {
    const mode = argv.out ? 'clockOut' : 'clockIn';
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
        await page.setGeolocation({ latitude: parseFloat(process.env.LATITUDE), longitude: parseFloat(process.env.LONGITUDE) });
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