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
  if (req.query.start_row_key) parameters.start_row_key = req.query.start_row_key;
  let result = await Tuya.devices(token).get_logs(device_id, parameters);
  res.send(result);
});

app.get("/", (req, res) => {
  res.send(
    `<h1>Tuya API</h1>
    <a href='/status'>status</a></n>
    <a href='/logs'>logs</a>`
  );
});

// post device commands
//let commands = { commands: [{ code: "switch_led", value: false }] };
//result = await Tuya.devices(token).post_commands(device_id, commands);

app.listen(port, () => {
  get_new_tokens();
  console.log(`Example app listening on port ${port}: http://localhost:${port}`);
});
