const generateTripPlan = require("./apis/generateTripPlan.js");
const recommendPoi = require("./apis/recommendPoi.js");
const getTripTicket = require("./apis/getTripTicket.js");

const skill = wx.modelContext.createSkill("skills/travel-skill");

skill.registerAPI("generateTripPlan", generateTripPlan);
skill.registerAPI("recommendPoi", recommendPoi);
skill.registerAPI("getTripTicket", getTripTicket);

console.log("[travel-skill] APIs registered");
