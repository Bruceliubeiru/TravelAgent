const DeviceGateway = require("./DeviceGateway");
const { createDeviceGateway } = require("./DeviceGatewayFactory");
const DeviceAdapter = require("./adapters/DeviceAdapter");
const MockMoyuntengAdapter = require("./adapters/MockMoyuntengAdapter");
const MoyuntengAdapter = require("./adapters/MoyuntengAdapter");
const RealAndroidAdapter = require("./adapters/RealAndroidAdapter");
const CloudPhoneAdapter = require("./adapters/CloudPhoneAdapter");

module.exports = {
  DeviceGateway,
  createDeviceGateway,
  DeviceAdapter,
  MockMoyuntengAdapter,
  MoyuntengAdapter,
  RealAndroidAdapter,
  CloudPhoneAdapter,
};
