/**
 * Side-effect-only module: registers every known plugin. Imported
 * once from mission.ts so `runMission` always has a fully-populated
 * registry, without every call site needing to remember to do it.
 *
 * Adding a new source is exactly two steps: write the plugin file in
 * ./plugins/, then add one line here.
 */

import { registerPlugin } from "./registry";
import { reelShortPlugin } from "./plugins/reelshort";
import { shortMaxPlugin } from "./plugins/shortmax";
import { dramaBoxPlugin } from "./plugins/dramabox";

registerPlugin(reelShortPlugin);
registerPlugin(shortMaxPlugin);
registerPlugin(dramaBoxPlugin);
