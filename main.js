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

let device_id, token, expire_time;
async function get_new_tokens() {
  // set some variables for the example
  device_id = config.deviceId;

  // get an access token
  let data = await Tuya.token().get_new();
  token = data?.result?.access_token;
  expire_time = data?.t + data?.result?.expire_time - 30;
  return token;
}

app.get("/status", async (req, res) => {
  // if token expired - get new
  if (new Date().getTime() > expire_time) get_new_tokens();

  // get device details
  let result = await Tuya.devices(token).get_details(device_id);
  res.send(result);
});

app.get("/logs", async (req, res) => {
  // if token expired - get new
  if (new Date().getTime() > expire_time) get_new_tokens();

  // get device details
  let parameters = { type: "7", start_time: "1", end_time: new Date().getTime().toString() };
  if (req.headers.start_row_key) parameters.start_row_key = req.headers.start_row_key;
  let result = await Tuya.devices(token).get_logs(device_id, parameters);
  result.header = req.headers.start_row_key ?? "";
  res.send(result);
});

app.get("/logs2", async (req, res) => {
  // if token expired - get new
  if (new Date().getTime() > expire_time) get_new_tokens();

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
    <a href='/status'>status</a></n>
    <a href='/logs'>logs</a>
    <a href='/logs2'>logs2</a>
    <a href='/logs2?transform=true'>logs2?transform=true</a>`
  );
});

// post device commands
//let commands = { commands: [{ code: "switch_led", value: false }] };
//result = await Tuya.devices(token).post_commands(device_id, commands);

app.listen(port, () => {
  get_new_tokens();
  console.log(`Example app listening on port ${port}: http://localhost:${port}`);
});
