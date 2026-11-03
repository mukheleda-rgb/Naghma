import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.naghma.player",
  appName: "نغمة",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
