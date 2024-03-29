require("dotenv").config();
const puppeteer = require("puppeteer");
const yargs = require("yargs");
const axios = require("axios").default;
const { hideBin } = require("yargs/helpers");
yargs(hideBin(process.argv))
  .command({
    command: "out",
    describe: "Clock out",
  })
  .parse();

const { argv } = yargs;
const mainLog = [];
let retry = 0;

process.env.TZ = "Asia/Jakarta";

function log(message) {
  const now = new Date();
  mainLog.push(`${message} : ${now.toUTCString()} `);
  console.log({ status: message });
}

async function hit() {
  const now = new Date();

  const day = now.getDay();
  const hour = now.getHours();
  const month = now.getMonth();
  const date = now.getDate();
  const mode = hour < 15 ? "clockIn" : "clockOut";
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const context = browser.defaultBrowserContext();

  const clockData = await axios.get(process.env.API_SPREADSHEET);
  const monthData = clockData.data.data.find((x) => x.date === date);
  const dayData = monthData[(month + 1).toString()]

  if (dayData === 'leave') {
    process.exit(0);
  }

  log("setting up browser");

  await context.overridePermissions(process.env.MACHINE_PATH, ["geolocation"]);

  await page.setViewport({
    width: 1024,
    height: 768,
    deviceScaleFactor: 1,
  });

  try {
    log("logging in to talenta");

    await page.goto(process.env.AUTH_PATH);

    await page.screenshot({ path: "images/talenta-0.png" });

    await page.type("#user_email", process.env.EMAIL);
    await page.type("#user_password", process.env.PASSWORD);
    await page.click("#new-signin-button");

    await page.screenshot({ path: "images/talenta-1.png" });

    await page.waitForNavigation({ waitUntil: "networkidle0" });
    await page.goto(process.env.MACHINE_PATH, {
      waitUntil: "networkidle0",
    });

    await page.screenshot({ path: "images/talenta-2.png" });

    log("set up geolocation");

    const coordinate = (
      day > 1 && day < 5
        ? process.env.COORDINATE_WFO
        : process.env.COORDINATE_WFH
    ).split(",");

    log(
      `current day is ${day}, setting to ${day > 1 && day < 5 ? "wfo" : "wfh"}`
    );

    await page.setGeolocation({
      latitude: parseFloat(coordinate[0]),
      longitude: parseFloat(coordinate[1]),
    });

    log("go to live attendance");

    await page.click('[href="/live-attendance"]');
    await page.waitForSelector(".d-flex.justify-content-between.mb-3");

    log("click button");

    log(`current hour is ${hour}, setting to ${mode}`);

    if (mode === "clockIn") {
      await page.mouse.click(400, 540);
    } else {
      await page.mouse.click(640, 540);
    }

    await page.waitForTimeout(5000);
    await page.screenshot({ path: "images/talenta-3.png" });

    log("logging out of talenta");

    await page.goto(process.env.LOGOUT_PATH);
    await browser.close();

    log("send notification");

    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: `Congratulation, <${process.env.SLACK_HANDLE}> ! You just ${
        mode === "clockIn" ? "clocked in" : "clocked out"
      }. Lets do some serious code! Check manually here ${
        process.env.MACHINE_PATH
      }. ${process.env.IMAGES_URL}/talenta-3.png?date=${Date.now()}
      `,
      unfurl_links: true,
      attachments: [
        {
          color: "#557D23",
          text: mainLog.join("\n"),
        },
      ],
    });

    console.log({ status: "success", mainLog });
    process.exit(0);
  } catch (error) {
    log("error catch");
    console.error({ status: "error", mainLog });

    await page.screenshot({ path: "images/talenta-9.png" });

    await page.goto(process.env.LOGOUT_PATH);
    await browser.close();

    if (retry < 5) {
      hit();
    } else {
      await axios.post(process.env.SLACK_WEBHOOK_URL, {
        text: `(Retry: ${retry})Uh oh! Something went wrong <${
          process.env.SLACK_HANDLE
        }!> You need to ${
          mode === "clockIn" ? "clocked in" : "clocked out"
        } manually here ${process.env.MACHINE_PATH}. ${
          process.env.IMAGES_URL
        }/talenta-9.png?date=${Date.now()}
        `,
        unfurl_links: true,
        attachments: [
          {
            color: "#93254F",
            text: error.message ? error.message : JSON.stringify(error),
          },
          {
            color: "#93254F",
            text: JSON.stringify(mainLog),
          },
        ],
      });
      process.exit(0);
    }
  }
  process.exit(0);
}

hit();
