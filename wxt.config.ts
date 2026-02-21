import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Monkey Meter",
    description:
      "Detect autopilot browsing drift with behavioral signals and reflective prompts.",
    version: "1.0.0",
    permissions: [
      "activeTab",
      "tabs",
      "storage",
      "scripting",
      "alarms",
      "idle",
      "favicon",
    ],
    host_permissions: ["<all_urls>"],
  },
  modules: ["@wxt-dev/auto-icons", "@wxt-dev/module-react"],
});
