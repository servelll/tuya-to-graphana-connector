const config = require("dotenv").config().parsed;
const TuyaCloud = require("tuyacloudnodejs");

let Tuya = new TuyaCloud({
  accessKey: config.accessKey,
  secretKey: config.secretKey,
  server: config.server,
});

const express = require("express");
const app = express();
const port = process.env.PORT || 8080;

let device_id, token, expire_time, last_update_time;
async function get_new_tokens() {
  // set some variables for the example
  device_id = config.deviceId;

  // get an access token
  let data = await Tuya.token().get_new();
  token = data?.result?.access_token;
  expire_time = data?.result?.expire_time * 1000 + data?.t - 10000;
  last_update_time = data?.t;
}

const conditionToUpDateTokens = () => !expire_time || Date.now() > expire_time;

app.get("/tokens", async (req, res) => {
  const c = new Date();
  res.send({
    token,
    expire_time,
    current_time: c.getTime(),
    diff: expire_time - c.getTime(),
    expire_time_date: new Date(expire_time),
    current_time_date: c,
    last_update_time: new Date(last_update_time),
  });
});

app.get("/status", async (req, res) => {
  // if token expired - get new
  if (conditionToUpDateTokens()) await get_new_tokens();

  // get device details
  let result = await Tuya.devices(token).get_details(device_id);
  res.send(result);
});

function trimQuotes(str) {
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

app.get("/logs", async (req, res) => {
  // if token expired - get new
  if (conditionToUpDateTokens()) await get_new_tokens();

  // get device details
  let parameters = { type: "7", start_time: "1", end_time: new Date().getTime().toString(), size: "10000" };
  if (req.headers.codes) parameters.codes = trimQuotes(req.headers.codes);
  if (req.headers.start_row_key) parameters.start_row_key = trimQuotes(req.headers.start_row_key);
  if (req.headers.start_time) parameters.start_time = trimQuotes(req.headers.start_time);
  if (req.headers.end_time) parameters.end_time = trimQuotes(req.headers.end_time);
  if (req.headers.size) parameters.size = trimQuotes(req.headers.size);
  let result = await Tuya.devices(token).get_logs(device_id, parameters);
  result.start_row_key = parameters.start_row_key ?? "";
  result.codes = parameters.codes ?? "";
  result.size = parameters.size ?? "";
  res.send(result);
});

app.get("/logs2", async (req, res) => {
  // if token expired - get new
  if (conditionToUpDateTokens()) await get_new_tokens();

  // get device details
  let parameters = { type: "1,2,3,4,5,6,7,8,9", start_time: "1", end_time: new Date().getTime().toString() };
  if (req.headers.start_row_key) parameters.start_row_key = req.headers.start_row_key;
  let result = await Tuya.devices(token).get_logs(device_id, parameters);
  let logs = result.result.logs;

  if (req.query.transform == "true") {
    for (let i = 0; i < logs.length; i++) {
      const current = logs[i];
      if (current.code === "cur_power") continue;

      let replacementValue = null;

      // Ищем cur_power выше в той же группе по времени
      for (let j = i - 1; j >= 0; j--) {
        const candidate = logs[j];
        if (candidate.event_time !== current.event_time) break;
        if (candidate.code === "cur_power") {
          replacementValue = candidate.value;
          break;
        }
      }

      // Если не нашли — ищем ниже с меньшим или тем же временем
      if (replacementValue === null) {
        for (let j = i + 1; j < logs.length; j++) {
          const candidate = logs[j];
          if (candidate.event_time <= current.event_time && candidate.code === "cur_power") {
            replacementValue = candidate.value;
            break;
          }
        }
      }

      if (replacementValue !== null) {
        current.value = replacementValue;
      } else {
        // Если не нашли, откусываем хвост от текущего индекса и выходим из цикла
        logs.splice(i);
        break;
      }
    }
  }
  res.send({ logs });
});

app.get("/", (req, res) => {
  res.send(
    `<h1>Tuya API</h1>
    <a href='/tokens'>tokens</a></n>
    <a href='/status'>status</a></n>
    <a href='/logs'>logs</a>
    <a href='/logs2'>logs2</a>
    <a href='/logs2?transform=true'>logs2?transform=true</a>`
  );
});

// post device commands
//let commands = { commands: [{ code: "switch_led", value: false }] };
//result = await Tuya.devices(token).post_commands(device_id, commands);

app.listen(port, async () => {
  await get_new_tokens();
  console.log(`Example app listening on port ${port}: http://localhost:${port}`);
});
