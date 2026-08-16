// First-launch defaults for options.txt / sodium-options.json.
// Bump DEFAULTS_VERSION when you change any of these values so existing users
// get the update on their next launch. (User-customized values are ALWAYS
// respected — we only fill in keys the user has not explicitly set.)
export const DEFAULTS_VERSION = 3;

// Soft defaults: filled only if the key is missing from options.txt.
// User customizations always win. Suits preferences (language, view bobbing).
export const DEFAULT_OPTIONS_SOFT: Record<string, string> = {
  lang: 'ko_kr',
  bobView: 'false',
  damageTiltStrength: '0.0',
  distortionEffectScale: '0.0',
  screenEffectScale: '0.0',

  // Skip Minecraft's first-launch onboarding overlays so our options.txt is
  // honored on a fresh install (accessibility popup + tutorial hints + narrator).
  onboardAccessibility: 'false',
  tutorialStep: 'none',
  narrator: '0'
};

// Hard overrides: forced on every DEFAULTS_VERSION apply, even if the key
// already has a different value. Suits prescriptive requests where the user
// explicitly asked for a specific binding.
// Action IDs verified against a live options.txt from MC 1.21.1 + our modpack.
export const DEFAULT_OPTIONS_HARD: Record<string, string> = {
  'key_accessories.key.open_accessories_screen': 'key.keyboard.unknown',
  'key_key.mute_microphone': 'key.keyboard.comma',
  'key_key.disable_voice_chat': 'key.keyboard.unknown',
  'key_key.hide_icons': 'key.keyboard.unknown',
  'key_gui.xaero_minimap_settings': 'key.keyboard.unknown',
  'key_gui.xaero_zoom_in': 'key.keyboard.unknown',
  'key_gui.xaero_zoom_out': 'key.keyboard.unknown',
  'key_gui.xaero_new_waypoint': 'key.keyboard.equal',
  'key_gui.xaero_open_map': 'key.keyboard.grave.accent'
};

// Built-in mod resource packs. Verified format from live options.txt:
//   "<modid>:<pack_folder>"    — NOT just the folder name.
// modid comes from fabric.mod.json > id; pack_folder is the directory under
// resourcepacks/ inside the mod jar.
export const DEFAULT_BUILTIN_PACK_IDS: string[] = [
  'cobblemon:gyaradosjump',            // Shinies for Magikarp Jump
  'cobbreeding:coloredeggs',           // Colored Eggs
  'mega_showdown:gyaradosjumpingmega', // 메가 갸라도스 다른 모습
  'mega_showdown:regionbiasmsd'        // MSD의 모습
  // Polymer resources apply at runtime — no options.txt entry needed.
];

// Written to config/sodium-options.json on first launch only. Sodium fills in
// its own defaults for any keys we omit here.
export const DEFAULT_SODIUM_CONFIG = {
  quality: {
    enable_vignette: false
  }
};
